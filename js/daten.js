/* ============================================================
   Datei:   js/daten.js
   Zweck:   Die Beispiel-Datenbank (die "Lager GmbH") mit allen
            Übungstabellen, ihre Beschreibungen und die Vorlage
            für eine eigene Tabelle.
   ============================================================ */

window.Spielplatz = window.Spielplatz || {};

/* --- 1. Tabellen und Startdaten --- */
Spielplatz.STARTDATEN = `
  CREATE TABLE kunden (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    stadt TEXT NOT NULL
  );
  CREATE TABLE lieferanten (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    land TEXT NOT NULL,
    bewertung INTEGER
  );
  CREATE TABLE artikel (
    id INTEGER PRIMARY KEY,
    bezeichnung TEXT NOT NULL,
    kategorie TEXT NOT NULL,
    preis REAL NOT NULL,
    bestand INTEGER NOT NULL,
    lieferant_id INTEGER REFERENCES lieferanten(id)
  );
  CREATE TABLE bestellungen (
    id INTEGER PRIMARY KEY,
    kunde_id INTEGER NOT NULL REFERENCES kunden(id),
    datum TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE positionen (
    id INTEGER PRIMARY KEY,
    bestellung_id INTEGER NOT NULL REFERENCES bestellungen(id),
    artikel_id INTEGER NOT NULL REFERENCES artikel(id),
    menge INTEGER NOT NULL
  );
  CREATE TABLE abteilungen (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    standort TEXT
  );
  CREATE TABLE mitarbeiter (
    id INTEGER PRIMARY KEY,
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    abteilung_id INTEGER REFERENCES abteilungen(id),
    position TEXT,
    gehalt REAL,
    eintritt TEXT,
    vorgesetzter_id INTEGER REFERENCES mitarbeiter(id)
  );

  INSERT INTO kunden VALUES
    (1, 'Müller GmbH', 'Hamburg'),
    (2, 'Schneider & Söhne', 'Berlin'),
    (3, 'Bäckerei Weber', 'Hamburg'),
    (4, 'Autohaus Koch', 'München'),
    (5, 'Praxis Dr. Richter', 'Köln'),
    (6, 'Gartenbau Lang', 'Berlin'),
    (7, 'Studio Nord', 'Kiel');

  INSERT INTO lieferanten VALUES
    (1, 'Nordpack GmbH', 'Deutschland', 5),
    (2, 'Polska Pal', 'Polen', 4),
    (3, 'ScanTech AG', 'Schweiz', 4),
    (4, 'SafeWork BV', 'Niederlande', 3),
    (5, 'Elektro Huber', 'Österreich', 5),
    (6, 'Billig & Schnell', 'China', 2);

  INSERT INTO artikel VALUES
    (1, 'Europalette', 'Verpackung', 14.50, 120, 2),
    (2, 'Stretchfolie', 'Verpackung', 6.90, 300, 1),
    (3, 'Karton 40x30', 'Verpackung', 1.20, 2500, 1),
    (4, 'Handscanner', 'Technik', 249.00, 12, 3),
    (5, 'Etikettendrucker', 'Technik', 389.00, 5, 3),
    (6, 'Sicherheitsschuhe', 'Schutz', 59.90, 40, 4),
    (7, 'Warnweste', 'Schutz', 4.50, 200, 4),
    (8, 'Gabelstapler-Batterie', 'Technik', 1290.00, 2, 5),
    (9, 'Umreifungsband', 'Verpackung', 22.00, 0, 1),
    (10, 'Schutzhelm', 'Schutz', 17.80, 35, 4);

  INSERT INTO bestellungen VALUES
    (1, 1, '2026-01-12', 'geliefert'),
    (2, 2, '2026-01-15', 'geliefert'),
    (3, 1, '2026-02-03', 'geliefert'),
    (4, 3, '2026-02-10', 'geliefert'),
    (5, 4, '2026-03-01', 'storniert'),
    (6, 2, '2026-03-18', 'unterwegs'),
    (7, 5, '2026-04-02', 'unterwegs'),
    (8, 1, '2026-04-20', 'offen'),
    (9, 6, '2026-04-22', 'offen'),
    (10, 3, '2026-05-05', 'offen');

  INSERT INTO positionen VALUES
    (1, 1, 1, 20), (2, 1, 2, 10), (3, 2, 4, 2), (4, 2, 5, 1),
    (5, 3, 3, 500), (6, 3, 2, 25), (7, 4, 3, 200), (8, 5, 8, 1),
    (9, 6, 6, 10), (10, 6, 7, 30), (11, 7, 10, 5), (12, 8, 1, 40),
    (13, 8, 9, 6), (14, 9, 7, 50), (15, 9, 10, 12), (16, 10, 3, 300),
    (17, 10, 1, 10);

  INSERT INTO abteilungen VALUES
    (1, 'Lager', 'Halle A'),
    (2, 'Einkauf', 'Büro 1. OG'),
    (3, 'Vertrieb', 'Büro 2. OG'),
    (4, 'Verwaltung', 'Büro 2. OG');

  INSERT INTO mitarbeiter VALUES
    (1, 'Sabine', 'Hartmann', 4, 'Geschäftsführung', 6800, '2012-04-01', NULL),
    (2, 'Jonas', 'Becker', 1, 'Lagerleitung', 4200, '2015-09-15', 1),
    (3, 'Leonie', 'Wolf', 1, 'Fachkraft Lagerlogistik', 3100, '2019-02-01', 2),
    (4, 'Murat', 'Yilmaz', 1, 'Fachkraft Lagerlogistik', 3050, '2020-06-01', 2),
    (5, 'Lisa', 'Schulz', 1, 'Staplerfahrerin', 2900, '2022-03-15', 2),
    (6, 'Tim', 'Neumann', 2, 'Einkaufsleitung', 4500, '2016-11-01', 1),
    (7, 'Anna', 'Fischer', 2, 'Einkäuferin', 3600, '2021-08-01', 6),
    (8, 'David', 'Krüger', 3, 'Vertriebsleitung', 4700, '2014-01-15', 1),
    (9, 'Julia', 'Braun', 3, 'Außendienst', 3800, '2018-05-01', 8),
    (10, 'Felix', 'Zimmermann', 3, 'Innendienst', 3300, '2023-01-09', 8),
    (11, 'Emma', 'Hoffmann', 4, 'Buchhaltung', 3500, '2017-07-01', 1),
    (12, 'Paul', 'Schmitt', 1, 'Auszubildender', 1100, '2025-08-01', 3);
`;

/* --- 2. Gruppen in der Seitenleiste (alles andere landet unter "Deine Tabellen") --- */
Spielplatz.TABELLEN_GRUPPEN = [
  { titel: 'Verkauf und Lager', tabellen: ['kunden', 'bestellungen', 'positionen', 'artikel', 'lieferanten'] },
  { titel: 'Personal', tabellen: ['mitarbeiter', 'abteilungen'] },
];

Spielplatz.TABELLEN_INFO = {
  kunden: 'Firmen, die bei uns bestellen',
  bestellungen: 'Wer wann bestellt hat',
  positionen: 'Was in welcher Bestellung steckt',
  artikel: 'Alles, was im Lager liegt',
  lieferanten: 'Firmen, von denen wir Ware beziehen',
  mitarbeiter: 'Wer bei uns arbeitet – mit Chef',
  abteilungen: 'Die Bereiche der Firma',
};

/* --- 3. Text im Editor beim allerersten Besuch --- */
Spielplatz.STARTABFRAGE = `-- Willkommen! Schreib hier SQL und drück Strg + Enter.
-- Links findest du Tabellen, Spickzettel und Beispiele.

SELECT bezeichnung, kategorie, preis, bestand
FROM artikel
ORDER BY preis DESC;`;

/* --- 4. Anleitung "Eigene Tabelle anlegen" (linke Spalte) --- */
Spielplatz.ANLEITUNG = {
  schritte: [
    {
      titel: 'Bauplan anlegen',
      text: 'CREATE TABLE legt die Tabelle an. Jede Spalte bekommt einen Namen und einen Datentyp.',
      code: 'CREATE TABLE fahrzeuge (\n  id INTEGER PRIMARY KEY,\n  bezeichnung TEXT NOT NULL,\n  baujahr INTEGER\n);',
    },
    {
      titel: 'Mit Daten befüllen',
      text: 'INSERT INTO fügt Zeilen ein. Die id lässt du weg, die vergibt SQLite selbst.',
      code: "INSERT INTO fahrzeuge (bezeichnung, baujahr)\nVALUES ('Stapler 1', 2019),\n       ('Ameise 3', 2022);",
    },
    {
      titel: 'Ansehen',
      text: 'Mit SELECT siehst du, was drinsteht. Die Tabelle erscheint außerdem links in der Liste.',
      code: 'SELECT * FROM fahrzeuge;',
    },
  ],
  typen: [
    ['INTEGER', 'ganze Zahl', '42'],
    ['REAL', 'Kommazahl', '19.99'],
    ['TEXT', 'Text', "'Hamburg'"],
    ['PRIMARY KEY', 'eindeutige Nummer jeder Zeile', ''],
    ['NOT NULL', 'Pflichtfeld, darf nicht leer sein', ''],
    ['REFERENCES', 'verweist auf eine andere Tabelle', ''],
  ],
  vorlage: `-- 1. Bauplan: Tabelle mit Spalten und Datentypen anlegen
DROP TABLE IF EXISTS fahrzeuge; -- falls es sie schon gibt
CREATE TABLE fahrzeuge (
  id INTEGER PRIMARY KEY,
  bezeichnung TEXT NOT NULL,
  typ TEXT,
  baujahr INTEGER,
  tragkraft_kg REAL
);

-- 2. Befüllen: mehrere Zeilen auf einmal
INSERT INTO fahrzeuge (bezeichnung, typ, baujahr, tragkraft_kg) VALUES
  ('Stapler 1', 'Gabelstapler', 2019, 2500),
  ('Stapler 2', 'Gabelstapler', 2023, 3000),
  ('Ameise 3', 'Hubwagen', 2022, 1800);

-- 3. Ansehen
SELECT * FROM fahrzeuge;`,
};
