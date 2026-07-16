# Autobahn-Überwachung: 45 Standorte → Nürnberg

Reine Frontend-Web-App (kein Server/Build nötig), die Vollsperrungen und andere
Verkehrsmeldungen auf den Autobahnrouten von 45 Firmenstandorten zum Ziel
Koblenzerstr. 13, 90451 Nürnberg anzeigt.

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

- 18 Autobahnen werden abgedeckt, aufgeteilt in:
  - **Kern-Autobahnen** (`A3`, `A6`, `A9`, `A73`, `A93`) — führen direkt auf
    Nürnberg zu. Hier bleibt der Richtungsfilter aktiv: Einträge werden
    anhand von `subtitle` (z. B. „Würzburg -> Nürnberg“) und Beschreibungs­text
    („Richtung Nürnberg“) auf die Fahrtrichtung Nürnberg gefiltert.
  - **Zubringer-Autobahnen** (`A1`, `A2`, `A4`, `A5`, `A7`, `A8`, `A13`,
    `A71`, `A81`, `A92`, `A95`, `A99`, `A113`) — werden auf den Strecken der
    45 Standorte zur Anbindung an die Kern-Autobahnen benötigt, liegen aber
    zu weit von Nürnberg entfernt, als dass ihre Richtungsangaben „Nürnberg“
    nennen würden. Hier werden beide Richtungen angezeigt, um keine
    Vollsperrung zu verpassen.
  - Für jede Autobahn werden die Endpunkte `roadworks`, `closure` und
    `warning` abgefragt.
  - Über die Checkbox „auch Gegenrichtung der Kern-Autobahnen anzeigen“
    lässt sich der Richtungsfilter für die Kern-Autobahnen deaktivieren.
  - Welche Autobahn(en) zu welchem der 45 Standorte gehören, ist in der
    ursprünglichen Streckenprüfung dokumentiert (mit dem Nutzer abgestimmt).
- Die Sektion „Weitere Meldungen“ gruppiert wie ursprünglich nach
  **Autobahn** (aufklappbar). Innerhalb jeder aufgeklappten Autobahn sind
  die Meldungen zusätzlich nach **Bundesland** gruppiert — ebenfalls als
  eigene aufklappbare Gruppe mit Pfeil, die erst per Klick ihre Einträge
  zeigt. Reihenfolge: beginnend mit Bayern (enthält das Ziel), danach
  aufsteigend nach Luftlinien-Entfernung der übrigen 15 Bundesländer von
  Nürnberg. Die Zuordnung erfolgt über den nächstgelegenen
  Bundesland-Zentroid zur Meldungs-Koordinate (`classifyBundesland` in
  `app.js`) — eine Näherung ohne echte Grenzpolygone, da die App bewusst
  ohne zusätzliche Geodaten/APIs auskommt.
- Eine Meldung gilt als **Vollsperrung**, wenn das API-Feld `isBlocked` gesetzt
  ist oder Titel/Beschreibung Begriffe wie „Vollsperrung“ / „komplett
  gesperrt“ / „in beide Richtungen gesperrt“ enthalten. Vollsperrungen werden
  oben rot hervorgehoben; alle anderen Meldungen (Baustellen, gesperrte
  Ein-/Ausfahrten, Warnungen) erscheinen darunter zur Einordnung.
- Automatische Aktualisierung alle 5 Minuten, zusätzlich manueller
  „Aktualisieren“-Button.
- Einträge mit Begriffen wie „Stau“, „Staugefahr“ oder „zähfließender
  Verkehr“ landen zusätzlich in einer eigenen, orange hervorgehobenen
  Sektion „Stauwarnungen“ zwischen den Vollsperrungen und den übrigen
  Meldungen. Die offizielle API liefert keine strukturierte Stau-Länge/
  -Dauer — das ist reine Texterkennung auf denselben Baustellen-/Warnungs-
  Daten.
- Zusätzlich zeigt eine eingebettete Google-Maps-Karte (`traffic-map.js`) die
  Stauintensität (Farb-Layer) rund um Nürnberg — die einzige kostenlos
  verfügbare Live-Stauansicht. Der API-Key liegt in `config.js` und ist per
  HTTP-Referrer-Restriktion in der Google Cloud Console auf die
  ausgelieferte Domain beschränkt. Google liefert darüber keine anklickbaren
  Sperrungs-/Unfall-Details — nur die Farbeinfärbung.
- Der Button „📌 Mini-Ansicht“ links neben „Aktualisieren“ öffnet ein
  kompaktes, frei skalierbares Fenster mit nur den Vollsperrungen und
  Stauwarnungen (`mini-view.js`). In Chrome/Edge nutzt das die
  **Document Picture-in-Picture API**, wodurch das Fenster immer im
  Vordergrund bleibt — auch über anderen Fenstern/Apps. In Browsern ohne
  diese API (z. B. Firefox/Safari) öffnet sich stattdessen ein normales,
  ebenfalls frei in der Größe veränderbares Popup-Fenster ohne die
  Always-on-Top-Eigenschaft. Die Mini-Ansicht aktualisiert sich automatisch
  bei jedem Refresh der Hauptseite.
  - Solange mindestens eine Vollsperrung aktiv und noch nicht bestätigt ist,
    blinkt das Mini-Fenster rot (Hintergrund wechselt sekündlich), und eine
    Leiste „Neue Vollsperrung!“ mit Button „✓ Gesehen“ erscheint. Das
    Blinken hört erst nach Klick auf „Gesehen“ auf — nicht von selbst. Ein
    Zahnradsymbol (⚙️) oben rechts im Mini-Fenster schaltet dieses Blinken
    komplett an/aus; die Einstellung wird in `localStorage`
    (`miniBlinkEnabled`) gespeichert und bleibt über Neuöffnen der
    Mini-Ansicht hinweg erhalten. Taucht später eine andere/neue
    Vollsperrung auf, blinkt es erneut, auch wenn eine frühere bereits
    bestätigt wurde.

## Hinweis

Die Erkennung von Vollsperrungen basiert auf Texterkennung, da die API kein
eigenes „Vollsperrung“-Flag liefert. Bei Unklarheiten bitte zusätzlich
offizielle Quellen (z. B. die Autobahn-App des Bundes) prüfen.
