# Autobahn-Überwachung A3 / A9 / A6 (Richtung Nürnberg)

Reine Frontend-Web-App (kein Server/Build nötig), die Vollsperrungen und andere
Verkehrsmeldungen für die A3, A9 und A6 in Fahrtrichtung Nürnberg anzeigt.

## Nutzung

Einfach `index.html` in einem Browser öffnen, oder lokal ausliefern:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Die App ruft direkt im Browser die offizielle Open-Data-API der Autobahn GmbH
des Bundes auf (`https://verkehr.autobahn.de`), die CORS für alle Origins
erlaubt — es ist kein eigener Backend-Proxy nötig.

## Funktionsweise

- Für A3, A9 und A6 werden die Endpunkte `roadworks`, `closure` und `warning`
  abgefragt.
- Einträge werden anhand von `subtitle` (z. B. „Würzburg -> Nürnberg“) und
  Beschreibungstexten („Richtung Nürnberg“) auf die Fahrtrichtung Nürnberg
  gefiltert. Über die Checkbox „auch andere Fahrtrichtungen anzeigen“ lässt
  sich der Filter deaktivieren.
- Eine Meldung gilt als **Vollsperrung**, wenn das API-Feld `isBlocked` gesetzt
  ist oder Titel/Beschreibung Begriffe wie „Vollsperrung“ / „komplett
  gesperrt“ / „in beide Richtungen gesperrt“ enthalten. Vollsperrungen werden
  oben rot hervorgehoben; alle anderen Meldungen (Baustellen, gesperrte
  Ein-/Ausfahrten, Warnungen) erscheinen darunter zur Einordnung.
- Automatische Aktualisierung alle 5 Minuten, zusätzlich manueller
  „Aktualisieren“-Button.
- Zusätzlich zeigt eine eingebettete Google-Maps-Karte (`traffic-map.js`) die
  Stauintensität (Farb-Layer) rund um Nürnberg. Der API-Key liegt in
  `config.js` und ist per HTTP-Referrer-Restriktion in der Google Cloud
  Console auf die ausgelieferte Domain beschränkt. Google liefert darüber
  keine anklickbaren Sperrungs-/Unfall-Details — nur die Farbeinfärbung.

## Hinweis

Die Erkennung von Vollsperrungen basiert auf Texterkennung, da die API kein
eigenes „Vollsperrung“-Flag liefert. Bei Unklarheiten bitte zusätzlich
offizielle Quellen (z. B. die Autobahn-App des Bundes) prüfen.
