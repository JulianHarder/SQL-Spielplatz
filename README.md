# SQL-Spielplatz

SQL lernen direkt im Browser, an einer kleinen Lager-Datenbank (Kunden, Artikel, Bestellungen, Positionen).

- 8 Lektionen: SELECT, WHERE, ORDER BY, Aggregatfunktionen, GROUP BY, JOIN, LEFT JOIN, mehrere JOINs
- Jede Lektion hat eine Aufgabe, die automatisch geprüft wird
- Beispiel einfügen, Lösung zeigen, Datenbank zurücksetzen
- Läuft komplett lokal: SQLite als WebAssembly ([sql.js](https://github.com/sql-js/sql.js)), keine Server, keine Daten verlassen den Browser

## Starten

`index.html` über einen lokalen Server öffnen, zum Beispiel:

```
python3 -m http.server 8000
```

Danach `http://localhost:8000` aufrufen. (Direkt per Doppelklick geht nicht, weil der Browser die WebAssembly-Datei sonst blockiert.)

## Aufbau

- `index.html` – Seite, Styling, Beispieldaten und Lektionen in einer Datei
- `lib/` – sql.js (MIT-Lizenz) mit der SQLite-WebAssembly-Datei

Gebaut mit HTML, CSS und reinem JavaScript.
