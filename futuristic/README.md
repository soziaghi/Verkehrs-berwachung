# Autobahn-Überwachung · Futuristic Edition

Visuelle Neugestaltung der Haupt-App (`../index.html`) im futuristischen
HUD-Stil (Glassmorphism, Neon-Akzente, Scanline, Grid-Hintergrund,
`Orbitron`/`Rajdhani`-Schrift). Die Original-Version unter `../index.html`
bleibt unverändert bestehen und weiter erreichbar.

Die Datenlogik (`app.js`, `config.js`, `traffic-map.js`) basiert auf der
Original-Version, wurde aber seither erweitert — `styles.css` und
`index.html` wurden neu gestaltet, `mini-view.js` wurde farblich an das
neue Design angepasst (gleiche Funktionsweise). Inzwischen hat sich die
futuristische Version funktional von der Original-Version gelöst:

- **Ausblenden-Funktion**: Jede Meldung hat eine Checkbox „Ausblenden“;
  ausgeblendete Meldungen landen im eigenen Tab „Ausgeblendet“ und lassen
  sich dort per Klick auf das Häkchen wieder zurückholen. Der Status wird
  in `localStorage` gespeichert.
- **Immer dunkles Design**: kein automatischer Wechsel zu einem hellen
  Farbschema, unabhängig vom Systemthema.
- **Autobahn-Status-Übersicht**: Kachel-Grid oberhalb der Listen mit
  Live-Status (grün/gelb/rot/grau) je überwachter Autobahn.
- **Center/Tour-Filter**: `standorte.js` enthält 43 Firmenstandorte
  (Center, Tour(en), Name, Adresse) inkl. der Autobahn(en) auf ihrer
  Route zum Ziel — einmalig per OpenStreetMap-Nominatim (Geokodierung)
  und OSRM (Routenberechnung) ermittelt, keine Live-API-Abhängigkeit.
  Über die Dropdowns „Center“ und „Tour“ lässt sich die gesamte Ansicht
  (Autobahn-Status, Meldungslisten, Mini-Ansicht) auf die für die Auswahl
  relevanten Autobahnen eingrenzen.
- **31 statt 18 überwachte Autobahnen**: Die Routenberechnung für die 43
  Standorte deckte 13 zusätzliche Autobahnen auf (A10, A27, A33, A44,
  A45, A46, A485, A60, A66, A661, A67, A70, A72), die jetzt ebenfalls
  überwacht werden.

## Nutzung

```bash
python3 -m http.server 8000
# dann http://localhost:8000/futuristic/ öffnen
```

Original-Version weiterhin unter `http://localhost:8000/` (bzw. der
bisherigen Adresse) erreichbar.
