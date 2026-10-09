# SQL-Spielplatz

SQL ausprobieren an einer echten SQLite-Datenbank – direkt im Browser, ohne Installation und ohne Server.

Die Beispieldatenbank ist eine kleine Lager-Firma mit sieben fertig gefüllten Tabellen.
Demo Webseite: https://julianharder.github.io/SQL-Spielplatz/

## Was er kann

- **Editor mit Komfort:** Syntax-Farben, Zeilennummern, automatisches Einrücken und Vorschläge beim Tippen
  (Schlüsselwörter, Funktionen, Tabellen und Spalten – auch nach Abkürzungen wie `k.`).
  <kbd>Strg</kbd> + <kbd>Enter</kbd> führt aus, markierter Text wird allein ausgeführt.
- **Sieben Beispieltabellen:** Fertig gefüllte Tabellen zum Üben (Kunden, Bestellungen, Positionen, Artikel, Lieferanten, Mitarbeiter, Abteilungen) – mit Spaltentypen, Primärschlüsseln und Verweisen.
- **Eigene Tabellen anlegen:** Anleitung in drei Schritten (anlegen, befüllen, ansehen) mit Datentypen und einer Vorlage zum Ausprobieren.
- **Spickzettel zum Aufklappen:** Alle 37 Befehle auf einen Blick, von `SELECT` bis `ALTER TABLE` – aufgeklappt jeweils *wann* man ihn braucht,
  *wie* man ihn schreibt und ein Beispiel zum direkten Ausprobieren. Dazu die Reihenfolge einer Abfrage auf einen Blick.
- **Beispiele:** 17 echte Fragen an die Firma, von „Was wird knapp?“ bis „Wer ist wessen Chef?“.
- **Verständliche Fehler:** Fehlermeldungen von SQLite werden auf Deutsch erklärt.
- **Verlauf:** Die letzten Abfragen lassen sich mit einem Klick zurückholen (wird beim Neuladen geleert).
- **Beispiele als Vorschau:** Beispiele aus Spickzettel und Beispielliste, die Daten ändern würden, zeigen nur das Ergebnis –
  die Übungstabellen bleiben dabei unverändert. Was man selbst in den Editor schreibt, gilt wirklich.
- **Nichts kaputt zu machen:** „Zurücksetzen“ stellt die Beispieldaten jederzeit wieder her.

## Starten

Einfach `index.html` im Browser öffnen – ein Doppelklick reicht. Die SQLite-Datei ist eingebettet, es wird nichts nachgeladen.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Gerüst der Seite und Icons |
| `css/stil.css` | Das komplette Aussehen |
| `js/daten.js` | Beispieldatenbank und Tabellenbeschreibungen |
| `js/spickzettel.js` | Begriffe des Spickzettels und die Beispiele |
| `js/editor.js` | Editor: Syntax-Farben, Zeilennummern, Vorschläge |
| `js/app.js` | Ausführen, Ergebnis, Tabellen, Verlauf |
| `lib/` | [sql.js](https://github.com/sql-js/sql.js) – SQLite als WebAssembly (MIT-Lizenz), die WebAssembly-Datei als Base64 in `sql-wasm-binaer.js` |
| `fonts/` | Inter und JetBrains Mono (SIL Open Font License) |

Gebaut mit HTML, CSS und reinem JavaScript, ohne Framework. Alles liegt lokal im Ordner, zur Laufzeit wird nichts nachgeladen.

## Lizenz

Der SQL-Spielplatz steht unter der [MIT-Lizenz](LICENSE) – nutzen, ändern und weitergeben ist erlaubt, solange der Copyright-Hinweis mitgeht.

Mitgelieferte fremde Teile behalten ihre eigene Lizenz: [sql.js](lib/LICENSE-sql.js) (MIT, SQLite selbst ist Public Domain) sowie die Schriften Inter und JetBrains Mono (SIL Open Font License).
