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
- **Center/Tour-Filter**: `standorte.js` enthält 44 Firmenstandorte
  (Center, Tour(en), Ort, Adresse) inkl. der Autobahn(en) auf ihrer
  Route zum Ziel — einmalig per OpenStreetMap-Nominatim (Geokodierung)
  und OSRM (Routenberechnung) ermittelt, keine Live-API-Abhängigkeit.
  Über die Dropdowns „Center“, „Tour“ und „Ort“ lässt sich die gesamte
  Ansicht (Autobahn-Status, Meldungslisten, Mini-Ansicht) auf die für
  die Auswahl relevanten Autobahnen eingrenzen.
- **32 statt 18 überwachte Autobahnen**: Die Routenberechnung für die 44
  Standorte deckte 14 zusätzliche Autobahnen auf (A10, A27, A33, A42,
  A44, A45, A46, A485, A60, A66, A661, A67, A70, A72), die jetzt
  ebenfalls überwacht werden.
- **Installierbar als PWA (iOS „Zum Home-Bildschirm“)**: `manifest.json`
  + `sw.js` (Service Worker) + `icons/` machen die Seite auf dem iPhone
  über Safari → Teilen → „Zum Home-Bildschirm“ installierbar — eigenes
  App-Icon, Start im Vollbild ohne Safari-Leiste. Der Service Worker
  cached nur die App-Shell (HTML/CSS/JS/Icons) für einen Offline-Start;
  Verkehrsdaten (Autobahn-API, Google Maps, TomTom) kommen weiterhin
  immer live aus dem Netz. Eine native App-Store-App (z. B. via
  Capacitor/Xcode) ist als nächster Schritt geplant, aber separat von
  dieser PWA.
- **UPS-Farbpalette**: Braun/Gold statt Neon-Cyan/Magenta; Statusfarben
  (Rot/Orange/Grün für Vollsperrung/Stau/OK) bleiben bewusst eigenständig.
- **TomTom Traffic API (`tomtom.js`), optional**: ergänzende Live-Quelle
  neben der Autobahn-GmbH-API — deckt auch Unfälle/Gefahrenstellen ab
  und erkennt Vollsperrung/Stau strukturiert (`iconCategory`/
  `magnitudeOfDelay`) statt per Textsuche. Erfordert einen eigenen,
  kostenlosen API-Key in `config.js`
  (`TOMTOM_API_KEY`, registrieren unter https://developer.tomtom.com/ →
  „My Apps“ → „Add API Key“ → Produkt „Traffic API“ aktivieren); ohne
  Key wird die Anbindung automatisch übersprungen (Status „TomTom:
  nicht konfiguriert“ im Header). Abgefragt werden nur 30 Kacheln
  (1°×1°, max. zulässige TomTom-Bounding-Box-Größe: 10.000 km²) rund um
  die 44 Standorte + Nürnberg — nicht ganz Deutschland, um im
  kostenlosen Kontingent (2.500 Requests/Tag) zu bleiben. Eigener
  Refresh-Zyklus alle 20 Minuten, unabhängig vom 5-Minuten-Takt der
  Autobahn-GmbH-Daten.

## Nutzung

```bash
python3 -m http.server 8000
# dann http://localhost:8000/futuristic/ öffnen
```

Original-Version weiterhin unter `http://localhost:8000/` (bzw. der
bisherigen Adresse) erreichbar.
