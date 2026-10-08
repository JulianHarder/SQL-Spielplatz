/* ============================================================
   Datei:   js/editor.js
   Zweck:   SQL-Editor: Syntax-Farben, Zeilennummern, automatisches
            Einrücken und Vorschläge beim Tippen.
            Technik: Ein unsichtbares <textarea> liegt genau über
            einem gefärbten <pre>. Getippt wird im textarea,
            gesehen wird das pre.
   ============================================================ */

window.Spielplatz = window.Spielplatz || {};

(function (S) {
  /* --- 1. Wortlisten --- */
  // Häufige Wörter zuerst, damit sie bei den Vorschlägen oben stehen
  const SCHLUESSELWOERTER = (
    'SELECT FROM WHERE AND OR NOT IN IS NULL LIKE BETWEEN AS DISTINCT ORDER BY ASC DESC LIMIT OFFSET ' +
    'GROUP HAVING JOIN INNER LEFT ON INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ' +
    'PRIMARY KEY INTEGER TEXT REAL CASE WHEN THEN ELSE END UNION ALL EXISTS'
  ).split(' ');
  const SELTENE_WOERTER = (
    'RIGHT FULL OUTER CROSS USING DROP ALTER ADD COLUMN RENAME TO FOREIGN REFERENCES BLOB NUMERIC ' +
    'EXCEPT INTERSECT WITH DEFAULT UNIQUE CHECK INDEX VIEW IF TRUE FALSE COLLATE NOCASE AUTOINCREMENT'
  ).split(' ');
  const FUNKTIONEN = (
    'COUNT SUM AVG MIN MAX ROUND ABS UPPER LOWER LENGTH SUBSTR TRIM REPLACE INSTR COALESCE IFNULL NULLIF ' +
    'STRFTIME DATE TIME DATETIME JULIANDAY GROUP_CONCAT TOTAL PRINTF CAST RANDOM'
  ).split(' ');
  const IST_SCHLUESSELWORT = new Set([...SCHLUESSELWOERTER, ...SELTENE_WOERTER]);
  const IST_FUNKTION = new Set(FUNKTIONEN);

  /* Wird von app.js nach jeder Änderung der Datenbank neu gefüllt */
  S.schema = { tabellen: [] };

  /* --- 2. Syntax-Farben --- */
  const MUSTER = /(--[^\n]*)|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(\s+)|([\s\S])/g;
  const OPERATOR = /[=<>!+\-*/%|,;().]/;

  S.maskieren = function (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  function namensSets() {
    const tabellen = new Set();
    const spalten = new Set();
    for (const t of S.schema.tabellen) {
      tabellen.add(t.name.toLowerCase());
      for (const s of t.spalten) spalten.add(s.name.toLowerCase());
    }
    return { tabellen, spalten };
  }

  S.faerben = function (sql) {
    const { tabellen, spalten } = namensSets();
    const teil = (klasse, text) => `<span class="t-${klasse}">${S.maskieren(text)}</span>`;
    let html = '';
    for (const [text, kommentar, zeichenkette, bezeichner, zahl, wort, leer] of sql.matchAll(MUSTER)) {
      if (kommentar) html += teil('kom', text);
      else if (zeichenkette) html += teil('str', text);
      else if (bezeichner) html += teil('spa', text);
      else if (zahl) html += teil('zahl', text);
      else if (wort) {
        const gross = wort.toUpperCase();
        const klein = wort.toLowerCase();
        if (IST_SCHLUESSELWORT.has(gross)) html += teil('key', text);
        else if (IST_FUNKTION.has(gross)) html += teil('fn', text);
        else if (tabellen.has(klein)) html += teil('tab', text);
        else if (spalten.has(klein)) html += teil('spa', text);
        else html += S.maskieren(text);
      } else if (leer) html += text;
      else html += OPERATOR.test(text) ? teil('op', text) : S.maskieren(text);
    }
    return html;
  };

  /* --- 3. Der Editor --- */
  S.Editor = function (wurzel, optionen) {
    const feld = wurzel.querySelector('textarea');
    const farbe = wurzel.querySelector('.editor__farbe');
    const code = farbe.querySelector('code');
    const zeilen = wurzel.querySelector('.editor__zeilen');
    const liste = wurzel.querySelector('.vorschlaege');
    const stil = getComputedStyle(wurzel);

    let zeichenBreite = 8.4;
    let vorschlaege = [];
    let markiert = 0;
    let wortLaenge = 0;
    let unterdruecken = false;

    /* 3a. Schreiben über execCommand, damit Strg + Z funktioniert */
    function schreiben(text, von, bis) {
      feld.focus();
      feld.setSelectionRange(von, bis);
      const geklappt = document.queryCommandSupported?.('insertText') && document.execCommand('insertText', false, text);
      if (!geklappt) {
        feld.setRangeText(text, von, bis, 'end');
        feld.dispatchEvent(new Event('input'));
      }
    }

    function zeichenBreiteMessen() {
      const probe = document.createElement('span');
      probe.textContent = 'x'.repeat(100);
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      code.append(probe);
      zeichenBreite = probe.getBoundingClientRect().width / 100 || zeichenBreite;
      probe.remove();
    }

    /* 3b. Anzeige neu aufbauen */
    function aktualisieren() {
      const text = feld.value;
      code.innerHTML = text
        ? S.faerben(text) + '\n'
        : '<span class="t-kom">-- Schreib hier dein SQL …</span>\n';
      const anzahl = text.split('\n').length;
      let nummern = '';
      for (let i = 1; i <= anzahl; i++) nummern += `<span>${i}</span>`;
      zeilen.innerHTML = nummern;
      wurzel.style.setProperty('--zeilen', Math.min(Math.max(anzahl, 9), 18));
      mitziehen();
      positionMelden();
    }

    function mitziehen() {
      farbe.scrollTop = feld.scrollTop;
      farbe.scrollLeft = feld.scrollLeft;
      zeilen.style.transform = `translateY(${-feld.scrollTop}px)`;
    }

    function positionMelden() {
      if (!optionen.beiPosition) return;
      const vor = feld.value.slice(0, feld.selectionStart).split('\n');
      optionen.beiPosition(vor.length, vor[vor.length - 1].length + 1);
    }

    /* 3c. Vorschläge */
    function aliasTabellen(text) {
      const zuordnung = {};
      for (const t of S.schema.tabellen) zuordnung[t.name.toLowerCase()] = t;
      const muster = /\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi;
      for (const [, tabelle, alias] of text.matchAll(muster)) {
        const t = zuordnung[tabelle.toLowerCase()];
        if (t && alias && !IST_SCHLUESSELWORT.has(alias.toUpperCase())) zuordnung[alias.toLowerCase()] = t;
      }
      return zuordnung;
    }

    function inTextOderKommentar(vor) {
      const zeile = vor.slice(vor.lastIndexOf('\n') + 1);
      if (zeile.includes('--')) return true;
      return (zeile.match(/'/g) || []).length % 2 === 1;
    }

    function kandidatenFinden() {
      const vor = feld.value.slice(0, feld.selectionStart);
      if (feld.selectionStart !== feld.selectionEnd || inTextOderKommentar(vor)) return { liste: [] };

      const mitPunkt = /([A-Za-z_]\w*)\.(\w*)$/.exec(vor);
      if (mitPunkt) {
        const tabelle = aliasTabellen(feld.value)[mitPunkt[1].toLowerCase()];
        if (!tabelle) return { liste: [] };
        const wort = mitPunkt[2].toLowerCase();
        return {
          laenge: mitPunkt[2].length,
          liste: tabelle.spalten
            .filter(s => s.name.toLowerCase().startsWith(wort) && s.name.toLowerCase() !== wort)
            .map(s => ({ text: s.name, art: 'spalte', info: `${tabelle.name} · ${s.typ}` })),
        };
      }

      const nurWort = /(?:^|[^\w.])([A-Za-z_]\w*)$/.exec(vor);
      if (!nurWort || nurWort[1].length < 2) return { liste: [] };
      const wort = nurWort[1].toLowerCase();
      const passt = name => name.toLowerCase().startsWith(wort) && name.toLowerCase() !== wort;

      const gesehen = new Set();
      const ergebnis = [];
      const nehmen = k => {
        const schluessel = k.text.toLowerCase();
        if (gesehen.has(schluessel)) return;
        gesehen.add(schluessel);
        ergebnis.push(k);
      };
      for (const t of S.schema.tabellen) if (passt(t.name)) nehmen({ text: t.name, art: 'tabelle', info: `${t.anzahl} Zeilen` });
      const spaltenOrte = {};
      for (const t of S.schema.tabellen) {
        for (const s of t.spalten) if (passt(s.name)) (spaltenOrte[s.name] = spaltenOrte[s.name] || []).push(t.name);
      }
      for (const [name, orte] of Object.entries(spaltenOrte)) nehmen({ text: name, art: 'spalte', info: orte.join(', ') });
      for (const w of SCHLUESSELWOERTER) if (passt(w)) nehmen({ text: w, art: 'schluesselwort', info: 'Schlüsselwort' });
      for (const f of FUNKTIONEN) if (passt(f)) nehmen({ text: f, art: 'funktion', info: 'Funktion' });
      for (const w of SELTENE_WOERTER) if (passt(w)) nehmen({ text: w, art: 'schluesselwort', info: 'Schlüsselwort' });
      return { laenge: nurWort[1].length, liste: ergebnis };
    }

    function vorschlagen() {
      const { laenge, liste: gefunden } = kandidatenFinden();
      vorschlaege = gefunden.slice(0, 7);
      if (!vorschlaege.length) return schliessen();
      wortLaenge = laenge;
      markiert = 0;
      zeichneVorschlaege();
      positionieren();
    }

    function zeichneVorschlaege() {
      const zeichen = { tabelle: 'T', spalte: 'S', schluesselwort: 'K', funktion: 'ƒ' };
      liste.innerHTML = vorschlaege.map((k, i) => `
        <li role="option" id="vorschlag-${i}" class="vorschlag vorschlag--${k.art}" aria-selected="${i === markiert}" data-index="${i}">
          <span class="vorschlag__art" aria-hidden="true">${zeichen[k.art]}</span>
          <span class="vorschlag__text">${S.maskieren(k.text)}</span>
          <span class="vorschlag__info">${S.maskieren(k.info)}</span>
        </li>`).join('');
      liste.hidden = false;
      feld.setAttribute('aria-expanded', 'true');
      feld.setAttribute('aria-activedescendant', `vorschlag-${markiert}`);
    }

    function positionieren() {
      const vor = feld.value.slice(0, feld.selectionStart).split('\n');
      const zeile = vor.length - 1;
      const spalte = vor[zeile].length - wortLaenge;
      const abstand = parseFloat(stil.getPropertyValue('--pad')) || 14;
      const hoehe = parseFloat(stil.getPropertyValue('--zh')) || 22;
      const rand = zeilen.parentElement.offsetWidth;
      let x = rand + abstand + spalte * zeichenBreite - feld.scrollLeft - 34;
      const y = abstand + (zeile + 1) * hoehe - feld.scrollTop + 4;
      x = Math.max(8, Math.min(x, wurzel.clientWidth - liste.offsetWidth - 8));
      liste.style.transform = `translate(${x}px, ${y}px)`;
    }

    function schliessen() {
      vorschlaege = [];
      liste.hidden = true;
      feld.setAttribute('aria-expanded', 'false');
      feld.removeAttribute('aria-activedescendant');
    }

    function uebernehmen(index) {
      const k = vorschlaege[index];
      if (!k) return;
      let text = k.text;
      if (k.art === 'funktion') text += '(';
      else if (k.art === 'schluesselwort') text += ' ';
      const ende = feld.selectionStart;
      unterdruecken = true;
      schreiben(text, ende - wortLaenge, ende);
      unterdruecken = false;
      schliessen();
    }

    /* 3d. Ereignisse */
    feld.addEventListener('input', () => {
      aktualisieren();
      optionen.beiAenderung?.(feld.value);
      if (!unterdruecken) vorschlagen();
    });
    feld.addEventListener('scroll', () => { mitziehen(); if (vorschlaege.length) positionieren(); });
    feld.addEventListener('click', () => { schliessen(); positionMelden(); });
    feld.addEventListener('keyup', e => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') positionMelden(); });
    feld.addEventListener('blur', () => setTimeout(schliessen, 120));

    feld.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        schliessen();
        optionen.beiAusfuehren?.();
        return;
      }
      if (vorschlaege.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          markiert = (markiert + (e.key === 'ArrowDown' ? 1 : vorschlaege.length - 1)) % vorschlaege.length;
          zeichneVorschlaege();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); uebernehmen(markiert); return; }
        if (e.key === 'Escape') { e.preventDefault(); schliessen(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        // Einrückung der aktuellen Zeile übernehmen
        const anfang = feld.value.lastIndexOf('\n', feld.selectionStart - 1) + 1;
        const einrueckung = /^[ \t]*/.exec(feld.value.slice(anfang))[0];
        e.preventDefault();
        unterdruecken = true;
        schreiben('\n' + einrueckung, feld.selectionStart, feld.selectionEnd);
        unterdruecken = false;
      }
    });

    liste.addEventListener('mousedown', e => {
      const eintrag = e.target.closest('[data-index]');
      if (!eintrag) return;
      e.preventDefault();
      uebernehmen(Number(eintrag.dataset.index));
    });

    document.fonts?.ready.then(() => { zeichenBreiteMessen(); aktualisieren(); });
    zeichenBreiteMessen();

    /* --- 4. Was app.js benutzen darf --- */
    return {
      wert: () => feld.value,
      auswahl: () => feld.value.slice(feld.selectionStart, feld.selectionEnd),
      setzen(text) {
        unterdruecken = true;
        schreiben(text, 0, feld.value.length);
        unterdruecken = false;
        feld.setSelectionRange(text.length, text.length);
        feld.scrollTop = 0;
        schliessen();
      },
      einfuegen(text) {
        const von = feld.selectionStart;
        const davor = feld.value[von - 1];
        const trenner = davor && !/[\s(.,]/.test(davor) ? ' ' : '';
        unterdruecken = true;
        schreiben(trenner + text, von, feld.selectionEnd);
        unterdruecken = false;
      },
      fokus: () => feld.focus(),
      neuFaerben: aktualisieren,
    };
  };
})(window.Spielplatz);
