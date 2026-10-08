/* ============================================================
   Datei:   js/app.js
   Zweck:   Startet SQLite (sql.js), führt Abfragen aus und baut
            die Seite: links Tabellen / Spickzettel / Beispiele,
            rechts Editor und ein Anzeigebereich, der je nach
            Klick das Ergebnis, eine Tabelle oder die Anleitung zeigt.
   ============================================================ */

(function (S) {
  const $ = auswahl => document.querySelector(auswahl);
  const m = S.maskieren;

  let SQL = null;
  let db = null;
  let editor = null;
  let veraendert = false;

  // Anzeigebereich: 'ergebnis' | 'tabelle' | 'anleitung'
  let ansicht = 'ergebnis';
  let aktiveTabelle = null;
  let ergebnis = { art: 'willkommen' }; // was zuletzt unter "Ergebnis" stand

  /* --- 1. Kleine Helfer --- */
  const speicher = {
    lesen(schluessel, standard) {
      try {
        const wert = localStorage.getItem('sql-spielplatz:' + schluessel);
        return wert === null ? standard : JSON.parse(wert);
      } catch { return standard; }
    },
    schreiben(schluessel, wert) {
      try { localStorage.setItem('sql-spielplatz:' + schluessel, JSON.stringify(wert)); } catch { /* egal */ }
    },
  };

  let toastZeit = null;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('toast--sichtbar');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(() => el.classList.remove('toast--sichtbar'), 2400);
  }

  const icon = name => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const zahlText = wert => (typeof wert !== 'number' || Number.isInteger(wert) ? String(wert) : String(Number(wert.toPrecision(12))));
  const dauer = ms => (ms < 1 ? '< 1 ms' : `${ms.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ms`);
  const plural = (n, eins, mehr) => `${n.toLocaleString('de-DE')} ${n === 1 ? eins : mehr}`;

  /* --- 2. Datenbank --- */
  function datenbankNeu() {
    if (db) db.close();
    db = new SQL.Database();
    db.run(S.STARTDATEN);
    veraendert = false;
    schemaLesen();
  }

  function schemaLesen() {
    const namen = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0]?.values.flat() ?? [];
    const reihenfolge = S.TABELLEN_GRUPPEN.flatMap(g => g.tabellen);
    const rang = name => (reihenfolge.includes(name) ? reihenfolge.indexOf(name) : 100);
    namen.sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
    S.schema.tabellen = namen.map(name => {
      const q = name.replace(/"/g, '""');
      const spalten = db.exec(`PRAGMA table_info("${q}")`)[0].values
        .map(([, spalte, typ, , , pk]) => ({ name: spalte, typ: (typ || 'beliebig').toLowerCase(), pk: pk > 0 }));
      const verweise = (db.exec(`PRAGMA foreign_key_list("${q}")`)[0]?.values ?? [])
        .map(([, , ziel, von, nach]) => ({ von, ziel, nach: nach || 'id' }));
      for (const s of spalten) s.verweis = verweise.find(v => v.von === s.name) || null;
      const anzahl = db.exec(`SELECT COUNT(*) FROM "${q}"`)[0].values[0][0];
      return { name, spalten, anzahl };
    });
  }

  function statusZeigen() {
    $('#status').classList.toggle('status--geaendert', veraendert);
    $('#status-text').textContent = veraendert ? 'Daten geändert' : `Bereit · ${plural(S.schema.tabellen.length, 'Tabelle', 'Tabellen')}`;
    $('#zuruecksetzen').classList.toggle('knopf--hervor', veraendert);
  }

  /* --- 3. Seitenleiste: Reiter --- */
  function reiterWechseln(name) {
    for (const knopf of document.querySelectorAll('[data-reiter]')) {
      const aktiv = knopf.dataset.reiter === name;
      knopf.setAttribute('aria-selected', aktiv);
      knopf.tabIndex = aktiv ? 0 : -1;
      $('#' + knopf.getAttribute('aria-controls')).hidden = !aktiv;
    }
    speicher.schreiben('reiter', name);
  }

  /* --- 4. Seitenleiste: Tabellen --- */
  const offeneTabellen = new Set();
  const STANDARD_TABELLEN = new Set(S.TABELLEN_GRUPPEN.flatMap(g => g.tabellen));

  function tabellenKarte(t) {
    const aktiv = ansicht === 'tabelle' && t.name === aktiveTabelle;
    return `
      <details class="tabelle${aktiv ? ' tabelle--aktiv' : ''}" data-tabellen-karte="${m(t.name)}"${offeneTabellen.has(t.name) ? ' open' : ''}>
        <summary class="tabelle__kopf">
          <span class="tabelle__icon">${icon('tabelle')}</span>
          <span class="tabelle__titel">
            <span class="tabelle__name">${m(t.name)}</span>
            <span class="tabelle__info">${m(S.TABELLEN_INFO[t.name] || 'Selbst angelegt')}</span>
          </span>
          <span class="zaehler" title="${plural(t.anzahl, 'Zeile', 'Zeilen')}">${t.anzahl}</span>
          ${icon('runter')}
        </summary>
        <ul class="tabelle__spalten">
          ${t.spalten.map(s => `
            <li>
              <button class="spalte" type="button" data-einfuegen="${m(s.name)}" title="„${m(s.name)}“ in die Abfrage einfügen">
                <span class="spalte__marke">${s.pk ? icon('schluessel') : s.verweis ? icon('pfeil') : ''}</span>
                <span class="spalte__name">${m(s.name)}</span>
                ${s.verweis ? `<span class="spalte__verweis">→ ${m(s.verweis.ziel)}</span>` : ''}
                <span class="spalte__typ">${m(s.typ)}</span>
              </button>
            </li>`).join('')}
        </ul>
        <button class="tabelle__ansehen" type="button" data-tabelle="${m(t.name)}">
          ${icon('tabelle')} Alle ${plural(t.anzahl, 'Zeile', 'Zeilen')} ansehen ${icon('pfeil')}
        </button>
      </details>`;
  }

  function seitenleisteZeichnen() {
    const finden = name => S.schema.tabellen.find(t => t.name === name);
    const gruppen = [
      ...S.TABELLEN_GRUPPEN.map(g => ({ titel: g.titel, tabellen: g.tabellen.map(finden).filter(Boolean) })),
      { titel: 'Deine Tabellen', tabellen: S.schema.tabellen.filter(t => !STANDARD_TABELLEN.has(t.name)), eigene: true },
    ];
    $('#tabellen-liste').innerHTML = gruppen.filter(g => g.tabellen.length).map(g => `
      <section class="tabellen-gruppe${g.eigene ? ' tabellen-gruppe--eigene' : ''}">
        <h3 class="mini-titel">${m(g.titel)}</h3>
        ${g.tabellen.map(tabellenKarte).join('')}
      </section>`).join('');
  }

  /* --- 5. Anzeigebereich (rechts unten) --- */
  function tabelleHtml(daten, spaltenInfo) {
    const zeilen = daten.values.slice(0, 1000);
    const istZahl = daten.columns.map((_, i) => zeilen.some(z => typeof z[i] === 'number') && zeilen.every(z => z[i] === null || typeof z[i] === 'number'));
    const kopf = daten.columns.map((name, i) => {
      const info = spaltenInfo?.[i];
      const marke = info?.pk ? icon('schluessel') : info?.verweis ? icon('pfeil') : '';
      const unter = info ? `<span class="th__typ">${m(info.typ)}${info.verweis ? ` → ${m(info.verweis.ziel)}` : ''}</span>` : '';
      return `<th scope="col" class="${istZahl[i] ? 'zahl' : ''}"><span class="th__name">${marke}${m(name)}</span>${unter}</th>`;
    }).join('');
    const rumpf = zeilen.map((zeile, nr) => `<tr style="--i:${Math.min(nr, 24)}">${zeile.map((wert, i) => {
      if (wert === null) return '<td><span class="null">NULL</span></td>';
      if (wert instanceof Uint8Array) return '<td class="leise">[Binärdaten]</td>';
      return `<td class="${istZahl[i] ? 'zahl' : ''}">${m(zahlText(wert))}</td>`;
    }).join('')}</tr>`).join('');
    const mehr = daten.values.length > zeilen.length
      ? `<p class="hinweis-zeile">Angezeigt werden die ersten ${zeilen.length.toLocaleString('de-DE')} von ${daten.values.length.toLocaleString('de-DE')} Zeilen.</p>` : '';
    return `<div class="tabelle-rahmen"><table class="daten"><thead><tr>${kopf}</tr></thead><tbody>${rumpf}</tbody></table></div>${mehr}`;
  }

  const zurueckKnopf = `<button type="button" class="knopf knopf--klein knopf--geist" data-zurueck>${icon('links')} Zurück zum Ergebnis</button>`;

  function ergebnisInhalt() {
    const e = ergebnis;
    if (e.art === 'willkommen') {
      return `
        <div class="willkommen">
          <div class="leer__bild">${icon('start')}</div>
          <h3>Willkommen im SQL-Spielplatz</h3>
          <p class="leise">Hier probierst du SQL an einer echten Datenbank aus. Kaputt machen kannst du nichts – „Zurücksetzen“ oben rechts stellt alles wieder her.</p>
          <ol class="willkommen__schritte">
            <li><button type="button" data-tabelle="kunden"><strong>Tabellen ansehen</strong><span>Links eine Tabelle aufklappen – ihre Daten erscheinen hier.</span></button></li>
            <li><button type="button" data-reiter-oeffnen="spickzettel"><strong>Im Spickzettel nachschlagen</strong><span>Einen Befehl aufklappen und das Beispiel ausprobieren.</span></button></li>
            <li><button type="button" data-start-ausfuehren><strong>Selbst schreiben</strong><span>Oben tippen – Vorschläge erscheinen von allein – und <kbd>Strg</kbd> + <kbd>Enter</kbd> drücken.</span></button></li>
          </ol>
        </div>`;
    }
    const hinweis = e.vorschau ? `
      <p class="vorschau-hinweis">${icon('info')}<span><strong>Nur eine Vorschau:</strong> So sieht das Ergebnis aus – deine Übungstabellen bleiben trotzdem unverändert.
        Führst du den Befehl selbst mit <kbd>Strg</kbd> + <kbd>Enter</kbd> aus, gilt er wirklich.</span></p>` : '';
    if (e.art === 'tabelle') {
      return hinweis + (e.daten.values.length
        ? tabelleHtml(e.daten)
        : `<div class="leer leer--klein"><h3>Keine Treffer</h3><p>Die Abfrage hat funktioniert, aber keine Zeile passt. Spalten: <code>${e.daten.columns.map(m).join(', ')}</code></p></div>`);
    }
    if (e.art === 'meldung') {
      const text = e.geaendert > 0 ? `${plural(e.geaendert, 'Zeile', 'Zeilen')} geändert.` : 'Befehl ausgeführt.';
      return hinweis + `
        <div class="meldung meldung--gut">
          <div class="meldung__icon">${icon('haken')}</div>
          <div><h3>${text}</h3><p>Tipp: Häng ein <code>SELECT</code> an, um das Ergebnis gleich zu sehen.</p></div>
        </div>`;
    }
    return `
      <div class="meldung meldung--fehler" role="alert">
        <div class="meldung__icon">${icon('warnung')}</div>
        <div>
          <h3>Das hat nicht geklappt</h3>
          <p>${m(fehlerErklaeren(e.text))}</p>
          <p class="meldung__original"><span>SQLite meldet</span><code>${m(e.text)}</code></p>
        </div>
      </div>`;
  }

  function anzeigen(neueAnsicht, tabelle) {
    if (neueAnsicht === 'tabelle' && !db) { toast('Die Datenbank startet noch – einen Moment bitte.'); return; }
    ansicht = neueAnsicht;
    if (tabelle) aktiveTabelle = tabelle;
    const kopf = $('#anzeige-kopf');
    const inhalt = $('#anzeige');

    if (ansicht === 'tabelle') {
      const t = S.schema.tabellen.find(x => x.name === aktiveTabelle);
      if (!t) return anzeigen('ergebnis');
      const daten = db.exec(`SELECT * FROM "${t.name.replace(/"/g, '""')}"`)[0] ?? { columns: t.spalten.map(s => s.name), values: [] };
      kopf.innerHTML = `
        <div class="anzeige-titel">${zurueckKnopf}<h2>${icon('tabelle')} ${m(t.name)}</h2><span class="leise klein">${plural(t.anzahl, 'Zeile', 'Zeilen')}</span></div>
        <button type="button" class="knopf knopf--klein" data-abfrage-fuer="${m(t.name)}">${icon('einfuegen')} Als Abfrage einfügen</button>`;
      inhalt.innerHTML = `
        <p class="leise klein abstand-unten">${m(S.TABELLEN_INFO[t.name] || 'Selbst angelegte Tabelle')}.
          ${icon('schluessel')} = eindeutige Nummer (Primärschlüssel), ${icon('pfeil')} = verweist auf eine andere Tabelle.</p>
        ${tabelleHtml(daten, t.spalten)}`;
    } else if (ansicht === 'anleitung') {
      kopf.innerHTML = `<div class="anzeige-titel">${zurueckKnopf}<h2>${icon('plus')} Eigene Tabelle anlegen</h2></div>`;
      inhalt.innerHTML = anleitungHtml();
    } else {
      const info = ergebnis.art === 'tabelle'
        ? `<span class="ergebnis-info"><span class="punkt punkt--gut"></span>${plural(ergebnis.daten.values.length, 'Zeile', 'Zeilen')} <span class="leise">· ${dauer(ergebnis.ms)}</span></span>
           <button class="knopf knopf--icon" type="button" data-kopieren title="Ergebnis kopieren (für Excel)" aria-label="Ergebnis kopieren">${icon('kopieren')}</button>`
        : '';
      kopf.innerHTML = `<div class="anzeige-titel"><h2>Ergebnis</h2></div><div class="kopf-aktionen">${info}</div>`;
      inhalt.innerHTML = ergebnisInhalt();
    }
    inhalt.scrollTop = 0;
    for (const karte of document.querySelectorAll('[data-tabellen-karte]')) {
      karte.classList.toggle('tabelle--aktiv', ansicht === 'tabelle' && karte.dataset.tabellenKarte === aktiveTabelle);
    }
  }

  function anleitungHtml() {
    const a = S.ANLEITUNG;
    return `
      <div class="anleitung">
        <p class="anleitung__intro leise">Eine Tabelle ist wie ein Formular mit festen Feldern: Erst legst du den Bauplan an, dann füllst du Zeilen hinein.</p>
        <ol class="schritte">
          ${a.schritte.map((st, i) => `
            <li class="schritt">
              <div class="schritt__text">
                <span class="schritt__nr">${i + 1}</span>
                <div><h4>${m(st.titel)}</h4><p>${m(st.text)}</p></div>
              </div>
              <pre><code>${S.faerben(st.code)}</code></pre>
            </li>`).join('')}
        </ol>
        <div class="anleitung__aktionen">
          <button type="button" class="knopf knopf--start" data-vorlage>${icon('start')} Alles auf einmal ausprobieren</button>
          <button type="button" class="knopf" data-vorlage-editor>${icon('einfuegen')} Vorlage in den Editor</button>
        </div>
        <h3 class="mini-titel">Datentypen und Regeln für Spalten</h3>
        <table class="typen">
          <tbody>
            ${a.typen.map(([typ, text, bsp]) => `<tr><th scope="row"><code>${m(typ)}</code></th><td>${m(text)}</td><td>${bsp ? `<code class="t-str">${m(bsp)}</code>` : ''}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function fehlerErklaeren(text) {
    const tabellen = S.schema.tabellen.map(t => t.name).join(', ');
    const regeln = [
      [/no such table: (\S+)/, t => `Die Tabelle „${t}“ gibt es nicht. Vorhanden sind: ${tabellen}.`],
      [/no such column: (\S+)/, s => `Die Spalte „${s}“ gibt es nicht. Prüfe die Schreibweise oder ob sie zur richtigen Tabelle gehört. Links unter „Tabellen“ siehst du alle Spalten.`],
      [/near "(.+?)": syntax error/, w => `Rund um „${w}“ versteht SQLite die Abfrage nicht. Oft fehlt ein Komma, ein Wort ist falsch geschrieben oder die Reihenfolge stimmt nicht (SELECT → FROM → WHERE → GROUP BY → ORDER BY).`],
      [/incomplete input/, () => 'Die Abfrage hört mittendrin auf. Fehlt am Ende etwas, zum Beispiel eine Klammer, ein Anführungszeichen oder der Tabellenname?'],
      [/ambiguous column name: (\S+)/, s => `Die Spalte „${s}“ gibt es in mehreren Tabellen. Schreib die Tabelle (oder ihre Abkürzung) davor, zum Beispiel k.${s.split('.').pop()}.`],
      [/misuse of aggregate/, () => 'Funktionen wie COUNT oder SUM dürfen nicht in WHERE stehen. Zum Filtern nach Gruppen gibt es HAVING.'],
      [/table (\S+) already exists/, t => `Die Tabelle „${t}“ gibt es schon. Nimm einen anderen Namen oder setz die Datenbank oben rechts zurück.`],
      [/duplicate column name: (\S+)/, s => `Die Spalte „${s}“ gibt es in dieser Tabelle schon. Setz die Datenbank oben rechts zurück, wenn du es noch einmal versuchen willst.`],
      [/NOT NULL constraint failed: (\S+)/, s => `Für „${s}“ fehlt ein Wert. Diese Spalte darf nicht leer bleiben.`],
      [/UNIQUE constraint failed: (\S+)/, s => `Den Wert für „${s}“ gibt es schon. Er muss eindeutig sein – lass die id einfach weg, dann vergibt SQLite sie selbst.`],
      [/(\d+) values for (\d+) columns/, (a, b) => `Du gibst ${a} Werte für ${b} Spalten an. Die Anzahl muss gleich sein.`],
      [/no such function: (\S+)/, f => `Die Funktion „${f}“ kennt SQLite nicht. Im Spickzettel findest du die verfügbaren Funktionen.`],
      [/unrecognized token: "(.+?)"/, t => `Mit „${t}“ kann SQLite nichts anfangen. Steht vielleicht ein Anführungszeichen zu viel oder zu wenig da?`],
    ];
    for (const [muster, erklaerung] of regeln) {
      const treffer = muster.exec(text);
      if (treffer) return erklaerung(...treffer.slice(1));
    }
    return 'SQLite konnte die Abfrage nicht ausführen. Die genaue Meldung steht unten.';
  }

  /* --- 6. Abfrage ausführen --- */
  function allesNeuZeichnen() {
    schemaLesen();
    seitenleisteZeichnen();
    statusZeigen();
    editor.neuFaerben();
  }

  // vorschau = true: Änderungen werden nach dem Anzeigen zurückgenommen (für Beispiele)
  function ausfuehren(text, vorschau = false) {
    if (!db) { toast('Die Datenbank startet noch – einen Moment bitte.'); return; }
    const sql = (text ?? (editor.auswahl().trim() || editor.wert())).trim();
    if (!sql || /^(--[^\n]*\s*)*$/.test(sql)) { toast('Das Feld ist noch leer – schreib eine Abfrage.'); return; }

    const knopf = $('#ausfuehren');
    knopf.classList.remove('knopf--puls');
    void knopf.offsetWidth;
    knopf.classList.add('knopf--puls');

    const aendert = /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b/i.test(sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, ''));
    const nurVorschau = vorschau && aendert;
    if (nurVorschau) db.exec('SAVEPOINT vorschau');
    const start = performance.now();
    try {
      const ergebnisse = db.exec(sql);
      const ms = performance.now() - start;
      const letztes = ergebnisse[ergebnisse.length - 1];
      ergebnis = letztes
        ? { art: 'tabelle', daten: letztes, ms, vorschau: nurVorschau }
        : { art: 'meldung', geaendert: db.getRowsModified(), ms, vorschau: nurVorschau };
      if (aendert && !nurVorschau) veraendert = true;
      verlaufMerken(sql, true, letztes ? plural(letztes.values.length, 'Zeile', 'Zeilen') : 'ausgeführt');
    } catch (fehler) {
      ergebnis = { art: 'fehler', text: fehler.message };
      verlaufMerken(sql, false, 'Fehler');
    } finally {
      if (nurVorschau) db.exec('ROLLBACK TO vorschau; RELEASE vorschau;');
      allesNeuZeichnen();
    }
    anzeigen('ergebnis');
  }

  function ausprobieren(sql, vorschau = true) {
    editor.setzen(sql);
    ausfuehren(sql, vorschau);
    if (matchMedia('(max-width: 1023px)').matches) $('#editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ergebnisKopieren() {
    if (ergebnis.art !== 'tabelle') return;
    const zelle = w => (w === null ? '' : String(zahlText(w)).replace(/[\t\n]/g, ' '));
    const text = [ergebnis.daten.columns, ...ergebnis.daten.values].map(z => z.map(zelle).join('\t')).join('\n');
    navigator.clipboard?.writeText(text)
      .then(() => toast('Ergebnis kopiert – lässt sich direkt in Excel einfügen.'))
      .catch(() => toast('Kopieren hat nicht geklappt.'));
  }

  /* --- 7. Spickzettel --- */
  function reihenfolgeZeichnen() {
    $('#reihenfolge').innerHTML = S.REIHENFOLGE.map((r, i) => `
      ${i ? '<span class="reihenfolge__pfeil" aria-hidden="true">›</span>' : ''}
      <button type="button" class="reihenfolge__teil${r.pflicht ? ' reihenfolge__teil--pflicht' : ''}" data-springen="${r.ziel}"
              title="${r.pflicht ? 'Pflicht' : 'Optional'} – klicken für die Erklärung">${r.teil}</button>`).join('');
  }

  function spickzettelZeichnen(filter = '') {
    const suche = filter.trim().toLowerCase();
    let treffer = 0;
    const gruppen = S.BEGRIFFE.map(gruppe => {
      const passende = gruppe.begriffe.filter(b => !suche ||
        [b.begriff, b.kurz, b.wann, b.syntax, b.hinweis || '', gruppe.titel].join(' ').toLowerCase().includes(suche));
      treffer += passende.length;
      return { gruppe, passende };
    });
    const aufklappen = suche && treffer <= 4;
    $('#begriffe').innerHTML = treffer ? gruppen.filter(g => g.passende.length).map(({ gruppe, passende }) => `
      <section class="gruppe">
        <h3 class="mini-titel">${m(gruppe.titel)}</h3>
        <div class="begriffe-liste">
          ${passende.map(b => `
            <details class="begriff" id="begriff-${b.id}"${aufklappen ? ' open' : ''}>
              <summary class="begriff__kopf">
                <code class="begriff__name">${m(b.begriff)}</code>
                <span class="begriff__kurz">${m(b.kurz)}</span>
                ${icon('runter')}
              </summary>
              <div class="begriff__inhalt">
                <p class="begriff__wann">${m(b.wann)}</p>
                <div class="begriff__beispiel">
                  <span class="etikett">Beispiel</span>
                  <pre data-ausprobieren="${b.id}" title="Klicken zum Ausführen"><code>${S.faerben(b.beispiel)}</code></pre>
                </div>
                <div class="begriff__aktionen">
                  <button type="button" class="knopf knopf--klein knopf--start-leise" data-ausprobieren="${b.id}">${icon('start')} Ausprobieren</button>
                  <button type="button" class="knopf knopf--klein knopf--geist" data-einfuegen-beispiel="${b.id}" title="Beispiel in den Editor schreiben, ohne es auszuführen">In den Editor</button>
                </div>
                <details class="begriff__muster">
                  <summary>Allgemeines Muster ${icon('runter')}</summary>
                  <pre><code>${S.faerben(b.syntax)}</code></pre>
                </details>
                ${b.hinweis ? `<p class="begriff__hinweis">${icon('info')}<span>${m(b.hinweis)}</span></p>` : ''}
              </div>
            </details>`).join('')}
        </div>
      </section>`).join('') : `
      <div class="leer leer--klein"><h3>Nichts gefunden</h3><p>Versuch es mit einem anderen Wort, zum Beispiel „sortieren“, „zählen“ oder „JOIN“.</p></div>`;
    $('#spick-anzahl').textContent = suche ? plural(treffer, 'Treffer', 'Treffer') : plural(treffer, 'Befehl', 'Befehle');
    alleKnopfAktualisieren();
  }

  function alleKnopfAktualisieren() {
    const alle = [...document.querySelectorAll('#begriffe details.begriff')];
    const knopf = $('#alle-aufklappen');
    knopf.hidden = !alle.length;
    knopf.textContent = alle.some(d => !d.open) ? 'Alle aufklappen' : 'Alle zuklappen';
  }

  function begriffFinden(id) {
    for (const gruppe of S.BEGRIFFE) for (const b of gruppe.begriffe) if (b.id === id) return b;
    return null;
  }

  function zuBegriffSpringen(id) {
    if ($('#suche').value) { $('#suche').value = ''; spickzettelZeichnen(); }
    reiterWechseln('spickzettel');
    const karte = $('#begriff-' + id);
    if (!karte) return;
    karte.open = true;
    karte.scrollIntoView({ behavior: 'smooth', block: 'center' });
    karte.classList.remove('begriff--blitz');
    void karte.offsetWidth;
    karte.classList.add('begriff--blitz');
  }

  /* --- 8. Beispiele --- */
  function beispieleZeichnen() {
    $('#beispiele').innerHTML = S.BEISPIELE.map((b, i) => `
      <article class="beispiel" data-beispiel="${i}">
        <h4>${m(b.titel)}</h4>
        <p>${m(b.text)}</p>
        <div class="beispiel__fuss">
          <div class="themen">${b.themen.map(t => `<span class="thema">${m(t)}</span>`).join('')}</div>
          <button type="button" class="knopf knopf--klein knopf--start-leise" data-beispiel-start="${i}">${icon('start')} Ausführen</button>
        </div>
      </article>`).join('');
  }

  /* --- 9. Verlauf (lebt nur bis zum Neuladen) --- */
  let verlauf = [];
  try { localStorage.removeItem('sql-spielplatz:verlauf'); } catch { /* egal */ }

  function verlaufMerken(sql, ok, info) {
    verlauf = [{ sql, ok, info, zeit: Date.now() }, ...verlauf.filter(v => v.sql !== sql)].slice(0, 25);
    verlaufZeichnen();
  }

  function verlaufZeichnen() {
    $('#verlauf-zahl').textContent = verlauf.length;
    $('#verlauf-leeren').hidden = !verlauf.length;
    $('#verlauf').innerHTML = verlauf.length ? verlauf.map((v, i) => `
      <li>
        <button type="button" class="verlauf-eintrag" data-verlauf="${i}" title="In den Editor übernehmen">
          <span class="verlauf-eintrag__kopf">
            <span class="punkt ${v.ok ? 'punkt--gut' : 'punkt--fehler'}"></span>
            <span>${m(v.info)}</span>
            <time class="leise">${new Date(v.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time>
          </span>
          <pre><code>${S.faerben(v.sql.split('\n').slice(0, 3).join('\n'))}${v.sql.split('\n').length > 3 ? '\n…' : ''}</code></pre>
        </button>
      </li>`).join('') : '<li class="leer leer--klein"><p>Noch leer. Jede Abfrage, die du ausführst, landet hier.</p></li>';
  }

  function verlaufUmschalten(offen) {
    const popup = $('#verlauf-popup');
    const zeigen = offen ?? popup.hidden;
    popup.hidden = !zeigen;
    $('#verlauf-knopf').setAttribute('aria-expanded', zeigen);
  }

  /* --- 10. Ereignisse verdrahten --- */
  function verdrahten() {
    $('#ausfuehren').addEventListener('click', () => ausfuehren());
    $('#zuruecksetzen').addEventListener('click', () => {
      datenbankNeu();
      allesNeuZeichnen();
      ergebnis = { art: 'willkommen' };
      anzeigen('ergebnis');
      toast('Datenbank ist wieder im Ausgangszustand.');
    });

    for (const knopf of document.querySelectorAll('[data-reiter]')) {
      knopf.addEventListener('click', () => reiterWechseln(knopf.dataset.reiter));
      knopf.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const alle = [...document.querySelectorAll('[data-reiter]')];
        const ziel = alle[(alle.indexOf(knopf) + (e.key === 'ArrowRight' ? 1 : -1) + alle.length) % alle.length];
        ziel.focus();
        ziel.click();
      });
    }

    document.addEventListener('click', e => {
      const t = e.target;
      if (!t.closest('.verlauf-menue')) verlaufUmschalten(false);
      if (t.closest('#verlauf-knopf')) { verlaufUmschalten(); return; }
      if (t.closest('[data-vorlage]')) { ausprobieren(S.ANLEITUNG.vorlage, false); return; }
      if (t.closest('[data-vorlage-editor]')) { editor.setzen(S.ANLEITUNG.vorlage); editor.fokus(); return; }
      if (t.closest('[data-anleitung-oeffnen]')) { anzeigen('anleitung'); return; }
      if (t.closest('[data-zurueck]')) { anzeigen('ergebnis'); return; }
      if (t.closest('[data-kopieren]')) { ergebnisKopieren(); return; }
      if (t.closest('[data-start-ausfuehren]')) { editor.fokus(); ausfuehren(); return; }

      const ziel = t.closest('[data-tabelle], [data-einfuegen], [data-abfrage-fuer], [data-ausprobieren], [data-einfuegen-beispiel], [data-springen], [data-beispiel-start], [data-verlauf], [data-reiter-oeffnen], .beispiel');
      if (!ziel) return;
      const d = ziel.dataset;
      if (d.tabelle) anzeigen('tabelle', d.tabelle);
      else if (d.einfuegen) editor.einfuegen(d.einfuegen);
      else if (d.abfrageFuer) { editor.setzen(`SELECT *\nFROM ${d.abfrageFuer};`); editor.fokus(); }
      else if (d.ausprobieren) ausprobieren(begriffFinden(d.ausprobieren).beispiel, d.ausprobieren !== 'create');
      else if (d.einfuegenBeispiel) { editor.setzen(begriffFinden(d.einfuegenBeispiel).beispiel); editor.fokus(); }
      else if (d.springen) zuBegriffSpringen(d.springen);
      else if (d.beispielStart) ausprobieren(S.BEISPIELE[d.beispielStart].sql);
      else if (d.verlauf) { editor.setzen(verlauf[d.verlauf].sql); editor.fokus(); verlaufUmschalten(false); }
      else if (d.reiterOeffnen) reiterWechseln(d.reiterOeffnen);
      else if (d.beispiel && !t.closest('button')) ausprobieren(S.BEISPIELE[d.beispiel].sql);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') verlaufUmschalten(false); });

    $('#suche').addEventListener('input', e => spickzettelZeichnen(e.target.value));
    $('#alle-aufklappen').addEventListener('click', () => {
      const alle = [...document.querySelectorAll('#begriffe details.begriff')];
      const oeffnen = alle.some(d => !d.open);
      for (const d of alle) d.open = oeffnen;
      alleKnopfAktualisieren();
    });
    $('#begriffe').addEventListener('toggle', alleKnopfAktualisieren, true);
    $('#verlauf-leeren').addEventListener('click', () => { verlauf = []; verlaufZeichnen(); });

    // Tabelle aufgeklappt: Spalten links, Daten rechts
    $('#tabellen-liste').addEventListener('toggle', e => {
      const karte = e.target;
      if (!karte.matches?.('[data-tabellen-karte]')) return;
      const name = karte.dataset.tabellenKarte;
      if (karte.open === offeneTabellen.has(name)) return; // nur neu gezeichnet, nicht geklickt
      if (karte.open) { offeneTabellen.add(name); anzeigen('tabelle', name); }
      else offeneTabellen.delete(name);
    }, true);
  }

  /* --- 11. Start --- */
  editor = S.Editor($('#editor'), {
    beiAusfuehren: () => ausfuehren(),
    beiAenderung: text => speicher.schreiben('entwurf', text),
  });
  $('#sql').value = speicher.lesen('entwurf', null) ?? S.STARTABFRAGE;
  editor.neuFaerben();

  reihenfolgeZeichnen();
  spickzettelZeichnen();
  beispieleZeichnen();
  verlaufZeichnen();
  verdrahten();
  reiterWechseln(speicher.lesen('reiter', 'tabellen'));
  anzeigen('ergebnis');

  // Die WebAssembly-Datei steckt als Base64 in lib/sql-wasm-binaer.js,
  // so muss nichts nachgeladen werden und es klappt auch per Doppelklick (file://)
  function wasmBinaer() {
    const text = atob(window.SQL_WASM_BASE64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes;
  }

  initSqlJs({ wasmBinary: wasmBinaer() })
    .then(geladen => {
      SQL = geladen;
      datenbankNeu();
      allesNeuZeichnen();
      // Jetzt sind die Tabellennamen bekannt und werden auch im Spickzettel eingefärbt
      spickzettelZeichnen($('#suche').value);
      document.body.classList.add('bereit');
    })
    .catch(fehler => {
      $('#status-text').textContent = 'Fehler beim Laden';
      $('#status').classList.add('status--fehler');
      $('#anzeige').innerHTML = `<div class="meldung meldung--fehler"><div class="meldung__icon">${icon('warnung')}</div><div><h3>Die Datenbank konnte nicht starten</h3><p>Lade die Seite bitte neu. Hilft das nicht, ist der Browser vielleicht zu alt für WebAssembly.</p><p class="meldung__original"><span>Technische Meldung</span><code>${m(fehler.message)}</code></p></div></div>`;
    });
})(window.Spielplatz);
