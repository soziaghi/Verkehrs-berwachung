// TomTom Traffic Incidents — ergänzende Live-Datenquelle neben der
// Autobahn-GmbH-API. Anders als die amtliche API liefert TomTom auch Unfälle/
// Gefahrenstellen und klassifiziert Vollsperrungen/Staus strukturiert
// (iconCategory/magnitudeOfDelay) statt per Textsuche.
//
// Kostenloser TomTom-Account: https://developer.tomtom.com/ (Key kommt in
// config.js). Ohne Key wird die TomTom-Anbindung automatisch übersprungen.
//
// Kachel-Einschränkung: TomTom erlaubt pro Bounding Box max. 10.000 km², für
// ganz Deutschland bräuchte man dutzende Kacheln pro Aktualisierung — bei
// 2.500 kostenlosen Nicht-Tile-Requests/Tag wäre das Kontingent sofort
// aufgebraucht. Stattdessen werden nur 1°×1°-Kacheln rund um die 44
// geokodierten Standort-Adressen (siehe standorte.js) + das Ziel Nürnberg
// abgefragt (30 Kacheln, einmalig berechnet) — Streckenabschnitte weit
// abseits dieser Orte sind dadurch nicht abgedeckt. Refresh-Intervall bewusst
// auf 20 Minuten gesetzt (30 Kacheln × 72 Zyklen/Tag = 2.160 Requests/Tag,
// unter dem Freemium-Limit).

const TOMTOM_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

// bbox-Format: minLon,minLat,maxLon,maxLat
const TOMTOM_TILES = [
  "9,47,10,48", "10,47,11,48", "11,47,12,48", "12,47,13,48", "8,48,9,49",
  "9,48,10,49", "10,48,11,49", "11,48,12,49", "12,48,13,49", "8,49,9,50",
  "9,49,10,50", "10,49,11,50", "11,49,12,50", "6,50,7,51", "8,50,9,51",
  "9,50,10,51", "10,50,11,51", "12,50,13,51", "6,51,7,52", "7,51,8,52",
  "8,51,9,52", "9,51,10,52", "12,51,13,52", "13,51,14,52", "14,51,15,52",
  "9,52,10,53", "13,52,14,53", "8,53,9,54", "9,53,10,54", "10,53,11,54",
];

// TomTom iconCategory → deutsches Label. "Stau"/"Vollsperrung" sind bewusst
// so benannt, dass sie von den bestehenden Textfiltern isStauWarnung()/
// isVollsperrung() in app.js erkannt werden, ohne diese anpassen zu müssen.
const TOMTOM_CATEGORY_LABELS = {
  0: "Verkehrsmeldung",
  1: "Unfall",
  2: "Nebel",
  3: "Gefahrenstelle",
  4: "Starkregen",
  5: "Glätte",
  6: "Stau",
  7: "Fahrstreifensperrung",
  8: "Vollsperrung",
  9: "Baustelle",
  10: "Starker Wind",
  11: "Überschwemmung",
  14: "Liegengebliebenes Fahrzeug",
};

function tomtomIncidentCoord(incident) {
  const geom = incident.geometry;
  if (!geom || !geom.coordinates) return null;
  const point = geom.type === "Point" ? geom.coordinates : geom.coordinates[0];
  if (!Array.isArray(point) || point.length < 2) return null;
  return { lat: point[1], long: point[0] };
}

function normalizeRoadNumber(raw) {
  return (raw || "").replace(/\s+/g, "").toUpperCase();
}

async function fetchTomTomTile(bbox) {
  const fields =
    "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,iconCategory},startTime,endTime,from,to,roadNumbers}}}";
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${encodeURIComponent(TOMTOM_API_KEY)}` +
    `&bbox=${encodeURIComponent(bbox)}&fields=${encodeURIComponent(fields)}&language=de-DE&timeValidityFilter=present`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom ${bbox}: HTTP ${res.status}`);
  const data = await res.json();
  return data.incidents || [];
}

// Baut pro betroffener (und überwachter) Autobahn ein eigenes Item — analog
// zur Autobahn-GmbH-API, die ebenfalls ein Item pro Straße liefert.
function buildTomTomItems(incident) {
  const props = incident.properties || {};
  const roadNumbers = (props.roadNumbers || [])
    .map(normalizeRoadNumber)
    .filter((road) => ROADS.includes(road));
  if (!roadNumbers.length) return [];

  const label = TOMTOM_CATEGORY_LABELS[props.iconCategory] || "Verkehrsmeldung";
  const isClosed = props.iconCategory === 8 || props.magnitudeOfDelay === 4;
  const coord = tomtomIncidentCoord(incident);
  const description = (props.events || []).map((e) => e.description).filter(Boolean);
  const subtitle = props.from && props.to ? `${props.from} -> ${props.to}` : props.from || props.to || "";

  return roadNumbers.map((road) => ({
    road,
    service: "tomtom",
    title: `${label} ${road}`,
    subtitle,
    description,
    coordinate: coord ? { lat: coord.lat, long: coord.long } : undefined,
    isBlocked: isClosed,
    identifier: `tomtom-${props.id || `${road}-${subtitle}`}-${road}`,
  }));
}

// service: "tomtom", damit app.js den Richtungsfilter für Kern-Autobahnen
// überspringen kann — TomTom liefert keinen "Richtung Nürnberg"-Text, an dem
// sich die Fahrtrichtung erkennen ließe.
async function loadTomTomIncidents() {
  if (!TOMTOM_API_KEY) return { items: [], failures: [] };

  const results = await Promise.allSettled(TOMTOM_TILES.map(fetchTomTomTile));
  const items = [];
  const failures = [];
  const seenIds = new Set();

  results.forEach((r) => {
    if (r.status !== "fulfilled") {
      failures.push(r.reason?.message || String(r.reason));
      return;
    }
    r.value.forEach((incident) => {
      const id = incident.properties && incident.properties.id;
      // Kacheln können an Rändern überlappende Incidents liefern.
      if (id) {
        if (seenIds.has(id)) return;
        seenIds.add(id);
      }
      items.push(...buildTomTomItems(incident));
    });
  });

  return { items, failures };
}
