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

// Vereinfachtes Umriss-Polygon Deutschlands (275 Punkte, [lon, lat]),
// abgeleitet aus der OpenStreetMap/Nominatim-Grenze (Douglas-Peucker-
// Vereinfachung, Toleranz 0.03°). Nötig, weil Nachbarländer dieselben
// Autobahn-Nummern vergeben (z. B. hat auch die niederländische A73 bei
// Nijmegen/Venlo diesen Namen) — ein reiner Namensabgleich würde solche
// Meldungen fälschlich als deutsche A73 einsortieren, da unsere TomTom-
// Kacheln bei grenznahen Standorten (Düsseldorf, Köln, Kempten, Bautzen …)
// ins Nachbarland hineinreichen.
const DE_BORDER_POLYGON = [[10.4544,47.5558],[10.8903,47.5373],[10.918,47.5136],[10.87,47.4833],[10.9372,47.4811],[10.9719,47.3996],[11.207,47.4339],[11.2699,47.3976],[11.4212,47.4446],[11.3838,47.4724],[11.4421,47.5179],[11.5724,47.5145],[11.6362,47.5946],[12.204,47.6068],[12.1624,47.7012],[12.257,47.743],[12.2552,47.6795],[12.4401,47.6952],[12.4992,47.6251],[12.7812,47.6738],[12.7586,47.6516],[12.8245,47.6121],[12.7791,47.5791],[12.8039,47.5501],[13.001,47.464],[13.0476,47.4922],[13.0807,47.687],[12.9053,47.7234],[13.0034,47.85],[12.7595,48.0752],[12.7581,48.1261],[13.0217,48.2578],[13.3298,48.3235],[13.4393,48.4308],[13.4378,48.5574],[13.509,48.5906],[13.7305,48.5148],[13.8258,48.6186],[13.8374,48.7005],[13.7949,48.7151],[13.8396,48.7716],[13.6286,48.9492],[13.4027,48.9872],[13.3974,49.0507],[13.1828,49.1345],[13.0291,49.3043],[12.7858,49.3455],[12.6556,49.4348],[12.6442,49.523],[12.5281,49.6181],[12.522,49.6864],[12.4006,49.7538],[12.4727,49.7861],[12.5477,49.9205],[12.2008,50.1087],[12.216,50.1682],[12.0924,50.2496],[12.1401,50.2778],[12.1008,50.318],[12.1846,50.3222],[12.2894,50.1769],[12.3354,50.172],[12.3313,50.2425],[12.512,50.3973],[12.7071,50.3971],[12.819,50.4603],[12.9122,50.4238],[12.9374,50.4063],[12.9481,50.4043],[13.0316,50.5097],[13.1953,50.5032],[13.2484,50.5921],[13.3232,50.5811],[13.3711,50.6508],[13.4649,50.6018],[13.5519,50.7137],[13.8549,50.727],[13.9008,50.7934],[14.3881,50.8993],[14.397,50.9363],[14.3026,50.9653],[14.3295,50.9823],[14.2587,50.9875],[14.3021,51.0551],[14.4086,51.0188],[14.5084,51.0433],[14.5991,50.9872],[14.5644,50.9186],[14.6502,50.9315],[14.6189,50.8578],[14.7941,50.8201],[14.9793,51.077],[15.0419,51.2729],[14.9651,51.3612],[14.974,51.4421],[14.729,51.5315],[14.7577,51.6613],[14.5902,51.8212],[14.6942,51.9019],[14.7591,52.0654],[14.6818,52.1156],[14.7156,52.2361],[14.5753,52.289],[14.5344,52.395],[14.6339,52.4915],[14.6038,52.531],[14.639,52.5733],[14.1229,52.8373],[14.1437,52.9614],[14.3486,53.0547],[14.3773,53.2018],[14.4506,53.2623],[14.3057,53.5436],[14.2836,53.7723],[14.1853,53.912],[14.2422,53.9877],[14.168,54.2388],[14.0696,54.2776],[14.0783,54.4411],[13.9976,54.649],[13.6498,54.839],[13.4272,54.885],[13.1566,54.858],[12.3222,54.5779],[12.2585,54.4512],[12.1652,54.3854],[11.6444,54.3308],[11.311,54.5296],[11.1413,54.5771],[10.6517,54.5102],[10.3388,54.5932],[10.1694,54.7382],[9.8943,54.8418],[9.7399,54.8233],[9.5927,54.8869],[9.2949,54.8017],[9.1431,54.873],[8.5554,54.9208],[8.5572,54.9928],[8.4724,55.0547],[8.0444,55.0992],[7.9498,54.9301],[7.9325,54.7349],[7.9646,54.6016],[8.1614,54.3333],[7.8459,54.3937],[7.5849,54.3109],[7.5276,54.2335],[7.5342,54.1399],[7.728,53.9941],[6.7269,53.8634],[6.3459,53.7245],[6.4126,53.6043],[6.8825,53.4473],[6.9268,53.3389],[7.1917,53.3151],[7.2174,53.007],[7.0873,52.8499],[7.0557,52.6434],[6.7526,52.6481],[6.71,52.6275],[6.7667,52.5616],[6.6809,52.5533],[6.6975,52.4863],[6.9417,52.4354],[6.9876,52.4698],[7.0722,52.3736],[7.0265,52.292],[7.0613,52.2347],[6.6947,52.0698],[6.8285,51.9641],[6.722,51.8961],[6.3906,51.874],[6.4072,51.828],[6.1562,51.9052],[6.1034,51.8925],[6.1666,51.8407],[6.0635,51.8655],[5.9455,51.8243],[5.9921,51.7702],[5.9552,51.7381],[6.1181,51.656],[6.0914,51.6058],[6.212,51.5134],[6.2264,51.3603],[6.0727,51.2426],[6.0822,51.1716],[6.1652,51.1944],[6.1388,51.1733],[6.1754,51.1585],[5.9578,51.0347],[5.8671,51.0467],[5.8971,50.9749],[6.0265,50.9833],[6.0182,50.9347],[6.094,50.9209],[6.0742,50.8465],[5.9748,50.7981],[6.0394,50.7184],[6.2664,50.6421],[6.1975,50.5296],[6.3751,50.4504],[6.3429,50.3802],[6.4055,50.3233],[6.3065,50.3202],[6.1756,50.2353],[6.1925,50.1821],[6.1397,50.1691],[6.1123,50.0597],[6.3214,49.8385],[6.5309,49.806],[6.5171,49.7235],[6.3569,49.5733],[6.3667,49.4696],[6.552,49.4248],[6.6023,49.3671],[6.5658,49.3478],[6.6703,49.2803],[6.7386,49.1637],[6.8342,49.1513],[6.838,49.2135],[6.9382,49.2224],[7.035,49.1914],[7.052,49.1129],[7.102,49.1558],[7.2936,49.115],[7.3653,49.172],[7.4458,49.1843],[7.6316,49.0549],[7.934,49.0579],[8.2326,48.9664],[7.8021,48.5886],[7.7442,48.3267],[7.5774,48.1202],[7.5689,48.0346],[7.6219,47.9725],[7.5566,47.878],[7.5218,47.6633],[7.6049,47.5779],[7.6938,47.6008],[7.6339,47.5612],[7.6803,47.5328],[7.8231,47.588],[7.9441,47.5439],[8.0893,47.5577],[8.2056,47.6211],[8.4342,47.5667],[8.5173,47.6342],[8.5826,47.5961],[8.6289,47.652],[8.4722,47.6386],[8.4081,47.7021],[8.568,47.8085],[8.6317,47.7582],[8.6569,47.8004],[8.7411,47.752],[8.728,47.6928],[8.7961,47.6753],[8.7698,47.7184],[8.8067,47.7383],[8.8942,47.6483],[9.0265,47.6868],[9.6804,47.5234],[9.777,47.5954],[9.8745,47.5285],[9.9707,47.5457],[10.0008,47.4821],[10.0916,47.4589],[10.0999,47.3548],[10.2362,47.3819],[10.174,47.2702],[10.4368,47.3804],[10.4759,47.4322],[10.4313,47.5038],[10.4544,47.5558]];

// Standard-Ray-Casting-Punkt-in-Polygon-Test.
function isInGermany(lat, lon) {
  let inside = false;
  for (let i = 0, j = DE_BORDER_POLYGON.length - 1; i < DE_BORDER_POLYGON.length; j = i++) {
    const [loni, lati] = DE_BORDER_POLYGON[i];
    const [lonj, latj] = DE_BORDER_POLYGON[j];
    const intersects =
      lati > lat !== latj > lat && lon < ((lonj - loni) * (lat - lati)) / (latj - lati) + loni;
    if (intersects) inside = !inside;
  }
  return inside;
}

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

  // Nachbarländer nutzen teils dieselben Autobahn-Nummern (z. B. NL-A73
  // bei Nijmegen/Venlo) — ohne Koordinate oder außerhalb Deutschlands
  // lässt sich das nicht sicher als deutsche Autobahn einordnen.
  const coord = tomtomIncidentCoord(incident);
  if (!coord || !isInGermany(coord.lat, coord.long)) return [];

  const label = TOMTOM_CATEGORY_LABELS[props.iconCategory] || "Verkehrsmeldung";
  const isClosed = props.iconCategory === 8 || props.magnitudeOfDelay === 4;
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
