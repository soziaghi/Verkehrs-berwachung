// Kern-Autobahnen: führen direkt auf Nürnberg zu, "Richtung Nürnberg"-Textfilter bleibt aktiv.
const CORE_ROADS = ["A3", "A6", "A9", "A73", "A93"];
// Zubringer-Autobahnen: liegen zu weit von Nürnberg entfernt für einen Richtungs-Textfilter,
// daher werden hier beide Richtungen angezeigt. Die Roads ab A10 kamen über die
// Center/Tour-Standortauswertung (routenbasiert per OSRM) als zusätzlich relevant hinzu.
const FEEDER_ROADS = [
  "A1", "A2", "A4", "A5", "A7", "A8", "A13", "A71", "A81", "A92", "A95", "A99", "A113",
  "A10", "A27", "A33", "A42", "A44", "A45", "A46", "A485", "A60", "A66", "A661", "A67", "A70", "A72",
];
const ROADS = [...CORE_ROADS, ...FEEDER_ROADS];
const SERVICES = ["roadworks", "closure", "warning"];
const API_BASE = "https://verkehr.autobahn.de/o/autobahn";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const refreshBtn = document.getElementById("refreshBtn");
const refreshLabel = document.getElementById("refreshLabel");
const spinner = document.getElementById("spinner");
const lastUpdated = document.getElementById("lastUpdated");
const closureList = document.getElementById("closureList");
const stauList = document.getElementById("stauList");
const noStau = document.getElementById("noStau");
const otherList = document.getElementById("otherList");
const noClosures = document.getElementById("noClosures");
const errorBanner = document.getElementById("errorBanner");
const allDirectionsToggle = document.getElementById("allDirectionsToggle");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const tabMainBtn = document.getElementById("tabMainBtn");
const tabHiddenBtn = document.getElementById("tabHiddenBtn");
const hiddenCount = document.getElementById("hiddenCount");
const mainView = document.getElementById("mainView");
const hiddenView = document.getElementById("hiddenView");
const hiddenList = document.getElementById("hiddenList");
const noHidden = document.getElementById("noHidden");
const roadStatusGrid = document.getElementById("roadStatusGrid");
const centerFilter = document.getElementById("centerFilter");
const tourFilter = document.getElementById("tourFilter");
const ortFilter = document.getElementById("ortFilter");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const filterInfo = document.getElementById("filterInfo");

let refreshTimer = null;
let lastItems = [];
let activeTab = "main";
let selectedCenter = "";
let selectedTour = "";
let selectedOrt = "";

const roadStatusTiles = new Map();

function buildOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

// Prüft, ob ein Standort zu den aktuell gewählten Filtern passt. `exclude`
// lässt eines der drei Kriterien aus, damit das zugehörige Dropdown seine
// eigenen Optionen unabhängig von seiner eigenen aktuellen Auswahl berechnen
// kann (sonst würde eine Auswahl ihre eigenen Alternativen wegfiltern).
function matchesFilters(s, exclude) {
  if (exclude !== "center" && selectedCenter && s.center !== selectedCenter) return false;
  if (exclude !== "tour" && selectedTour && !s.tours.includes(selectedTour)) return false;
  if (exclude !== "ort" && selectedOrt && s.ort !== selectedOrt) return false;
  return true;
}

function populateSelect(selectEl, values, placeholder, current) {
  selectEl.innerHTML = "";
  selectEl.appendChild(buildOption("", placeholder));
  values.forEach((v) => selectEl.appendChild(buildOption(v, v)));
  const value = values.includes(current) ? current : "";
  selectEl.value = value;
  return value;
}

function refreshFilterOptions() {
  const centers = [...new Set(STANDORTE.filter((s) => matchesFilters(s, "center")).map((s) => s.center))].sort(
    (a, b) => a.localeCompare(b, "de")
  );
  const tours = [...new Set(STANDORTE.filter((s) => matchesFilters(s, "tour")).flatMap((s) => s.tours))].sort(
    (a, b) => a.localeCompare(b, "de")
  );
  const orte = [...new Set(STANDORTE.filter((s) => matchesFilters(s, "ort")).map((s) => s.ort))].sort((a, b) =>
    a.localeCompare(b, "de")
  );

  selectedCenter = populateSelect(centerFilter, centers, "Alle Center", selectedCenter);
  selectedTour = populateSelect(tourFilter, tours, "Alle Touren", selectedTour);
  selectedOrt = populateSelect(ortFilter, orte, "Alle Orte", selectedOrt);
}

function currentAllowedRoads() {
  if (!selectedCenter && !selectedTour && !selectedOrt) return null;
  const matches = STANDORTE.filter((s) => matchesFilters(s, null));
  const roads = new Set();
  matches.forEach((s) => s.roads.forEach((r) => roads.add(r)));
  return roads;
}

function updateFilterInfo() {
  const allowed = currentAllowedRoads();
  if (!allowed) {
    filterInfo.hidden = true;
    filterInfo.textContent = "";
    return;
  }
  filterInfo.hidden = false;
  const list = ROADS.filter((r) => allowed.has(r));
  filterInfo.textContent = list.length
    ? `Gefiltert auf: ${list.join(", ")}`
    : "Keine Autobahnen für diese Auswahl gefunden.";
}

refreshFilterOptions();

function buildRoadStatusGrid() {
  ROADS.forEach((road) => {
    const tile = document.createElement("div");
    tile.className = "road-tile status-ok";

    const label = document.createElement("span");
    label.className = "road-tile-label";
    label.textContent = road;
    tile.appendChild(label);

    const bar = document.createElement("span");
    bar.className = "road-tile-bar";
    tile.appendChild(bar);

    roadStatusGrid.appendChild(tile);
    roadStatusTiles.set(road, tile);
  });
}
buildRoadStatusGrid();

const HIDDEN_STORAGE_KEY = "ausgeblendeteMeldungen";

function loadHiddenKeys() {
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}

function saveHiddenKeys() {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...hiddenKeys]));
  } catch (err) {
    // localStorage kann in manchen Kontexten (z. B. privates Fenster) fehlschlagen.
  }
}

let hiddenKeys = loadHiddenKeys();

function itemKey(item) {
  return item.identifier || `${item.road}|${item.service}|${item.title || ""}|${item.subtitle || ""}`;
}

function setHidden(item, hidden) {
  const key = itemKey(item);
  if (hidden) hiddenKeys.add(key);
  else hiddenKeys.delete(key);
  saveHiddenKeys();
  render(lastItems, []);
}

const NUERNBERG_COORD = { lat: 49.4521, lon: 11.0767 };

// Grobe Zentroiden je Bundesland, nur zur Zuordnung einzelner Meldungen per
// Koordinaten-Nächster-Nachbar-Suche — keine exakten Grenzen.
const BUNDESLAND_CENTROIDS = {
  "Bayern": [48.79, 11.4],
  "Baden-Württemberg": [48.66, 9.35],
  "Thüringen": [50.9, 11.0],
  "Hessen": [50.52, 9.0],
  "Sachsen": [51.05, 13.2],
  "Rheinland-Pfalz": [49.91, 7.45],
  "Sachsen-Anhalt": [51.9, 11.6],
  "Saarland": [49.4, 6.97],
  "Nordrhein-Westfalen": [51.43, 7.45],
  "Brandenburg": [52.4, 13.1],
  "Niedersachsen": [52.7, 9.5],
  "Berlin": [52.52, 13.4],
  "Bremen": [53.08, 8.8],
  "Hamburg": [53.55, 10.0],
  "Mecklenburg-Vorpommern": [53.7, 12.9],
  "Schleswig-Holstein": [54.3, 9.7],
};

function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat1 - lat2) * 111;
  const dLon = (lon1 - lon2) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Bayern zuerst (enthält das Ziel Nürnberg), danach aufsteigend nach
// Luftlinien-Entfernung der Zentroide von Nürnberg sortiert.
const BUNDESLAND_ORDER = Object.keys(BUNDESLAND_CENTROIDS)
  .sort((a, b) => {
    if (a === "Bayern") return -1;
    if (b === "Bayern") return 1;
    const [latA, lonA] = BUNDESLAND_CENTROIDS[a];
    const [latB, lonB] = BUNDESLAND_CENTROIDS[b];
    const dA = distanceKm(NUERNBERG_COORD.lat, NUERNBERG_COORD.lon, latA, lonA);
    const dB = distanceKm(NUERNBERG_COORD.lat, NUERNBERG_COORD.lon, latB, lonB);
    return dA - dB;
  })
  .concat("Unbekannt");

function itemCoord(item) {
  if (item.coordinate && item.coordinate.lat != null && item.coordinate.long != null) {
    return { lat: Number(item.coordinate.lat), lon: Number(item.coordinate.long) };
  }
  if (typeof item.point === "string") {
    const parts = item.point.split(",").map(Number);
    if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
      return { lat: parts[0], lon: parts[1] };
    }
  }
  return null;
}

function classifyBundesland(item) {
  const coord = itemCoord(item);
  if (!coord) return "Unbekannt";
  let best = "Unbekannt";
  let bestDist = Infinity;
  for (const [land, [lat, lon]] of Object.entries(BUNDESLAND_CENTROIDS)) {
    const d = distanceKm(coord.lat, coord.lon, lat, lon);
    if (d < bestDist) {
      bestDist = d;
      best = land;
    }
  }
  return best;
}

function isDirectionNuernberg(item) {
  const subtitle = item.subtitle || "";
  const arrowParts = subtitle.split("->");
  if (arrowParts.length === 2) {
    const dest = arrowParts[1].toLowerCase();
    if (dest.includes("nürnberg") || dest.includes("nuernberg")) return true;
  }
  const fullText = `${item.title || ""} ${subtitle} ${(item.description || []).join(" ")}`.toLowerCase();
  return /richtung n(ü|ue)rnberg/.test(fullText);
}

function isVollsperrung(item) {
  if (item.isBlocked === "true" || item.isBlocked === true) return true;
  const fullText = `${item.title || ""} ${item.subtitle || ""} ${(item.description || []).join(" ")}`.toLowerCase();
  if (/vollsperr/.test(fullText)) return true;
  if (/(komplett|voll(ständig)?) gesperrt/.test(fullText)) return true;
  if (/in beide richtungen gesperrt/.test(fullText)) return true;
  return false;
}

function isStauWarnung(item) {
  const fullText = `${item.title || ""} ${item.subtitle || ""} ${(item.description || []).join(" ")}`.toLowerCase();
  return /\bstau\b|staugefahr|stockender verkehr|zähfließend|zaehfliessend|verkehr staut/.test(fullText);
}

async function fetchRoadService(road, service) {
  const url = `${API_BASE}/${road}/services/${service}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${road}/${service}: HTTP ${res.status}`);
  const data = await res.json();
  const items = data[service] || [];
  return items.map((item) => ({ ...item, road, service }));
}

async function loadAll() {
  setLoading(true);
  errorBanner.hidden = true;
  const results = await Promise.allSettled(
    ROADS.flatMap((road) => SERVICES.map((service) => fetchRoadService(road, service)))
  );

  const items = [];
  const failures = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else failures.push(r.reason?.message || String(r.reason));
  });

  lastItems = items;
  render(items, failures);
  setLoading(false);
  lastUpdated.textContent = `Zuletzt aktualisiert: ${new Date().toLocaleTimeString("de-DE")}`;
}

function setLoading(loading) {
  refreshBtn.disabled = loading;
  spinner.hidden = !loading;
  refreshLabel.textContent = loading ? "Lädt…" : "Aktualisieren";
}

function render(items, failures) {
  const showAllDirections = allDirectionsToggle.checked;
  const relevant = items.filter((item) => {
    if (showAllDirections) return true;
    if (CORE_ROADS.includes(item.road)) return isDirectionNuernberg(item);
    return true;
  });

  const allowedRoads = currentAllowedRoads();
  const scoped = allowedRoads
    ? relevant.filter((item) => allowedRoads.has(item.road))
    : relevant;

  renderRoadStatus(scoped, failures, allowedRoads);

  const visible = scoped.filter((item) => !hiddenKeys.has(itemKey(item)));
  const hidden = scoped.filter((item) => hiddenKeys.has(itemKey(item)));

  const closures = visible.filter(isVollsperrung);
  const remaining = visible.filter((item) => !isVollsperrung(item));
  const stauWarnungen = remaining.filter(isStauWarnung);
  const others = remaining.filter((item) => !isStauWarnung(item));

  renderStatusBadge(closures, failures);
  renderClosures(closures);
  renderStauWarnungen(stauWarnungen);
  renderOthers(others);
  renderHidden(hidden);
  updateTabUI();
  if (typeof updateMiniView === "function") updateMiniView(closures, stauWarnungen);

  if (failures.length) {
    errorBanner.hidden = false;
    errorBanner.textContent = `Einige Daten konnten nicht geladen werden: ${failures.join(" · ")}`;
  }
}

function renderHidden(hiddenItems) {
  hiddenCount.textContent = hiddenItems.length ? `(${hiddenItems.length})` : "";
  hiddenList.innerHTML = "";
  noHidden.hidden = hiddenItems.length > 0;
  hiddenItems
    .sort((a, b) => a.road.localeCompare(b.road))
    .forEach((item) => {
      let variant = "";
      if (isVollsperrung(item)) variant = "closure";
      else if (isStauWarnung(item)) variant = "stau";
      hiddenList.appendChild(buildCard(item, variant, true));
    });
}

function updateTabUI() {
  mainView.hidden = activeTab !== "main";
  hiddenView.hidden = activeTab !== "hidden";
  tabMainBtn.classList.toggle("active", activeTab === "main");
  tabHiddenBtn.classList.toggle("active", activeTab === "hidden");
}

function renderRoadStatus(relevantItems, failures, allowedRoads) {
  const failedRoads = new Set(
    failures.map((msg) => (msg || "").split("/")[0].trim()).filter(Boolean)
  );

  ROADS.forEach((road) => {
    const tile = roadStatusTiles.get(road);
    if (!tile) return;

    if (allowedRoads && !allowedRoads.has(road)) {
      tile.hidden = true;
      return;
    }
    tile.hidden = false;

    const roadItems = relevantItems.filter((item) => item.road === road);
    const closureCount = roadItems.filter(isVollsperrung).length;
    const stauCount = roadItems.filter(
      (item) => !isVollsperrung(item) && isStauWarnung(item)
    ).length;

    let status = "ok";
    if (closureCount > 0) status = "closure";
    else if (stauCount > 0) status = "stau";
    else if (failedRoads.has(road)) status = "error";

    tile.className = `road-tile status-${status}`;
    tile.title =
      status === "error"
        ? `${road}: Daten konnten nicht geladen werden`
        : `${road}: ${closureCount} Vollsperrung${closureCount === 1 ? "" : "en"} · ${stauCount} Stauwarnung${stauCount === 1 ? "" : "en"}`;
  });
}

function renderStatusBadge(closures, failures) {
  statusBadge.classList.remove("ok", "alert", "error");
  if (failures.length) {
    statusBadge.classList.add("error");
    statusText.textContent = `${failures.length} von ${ROADS.length} Autobahnen nicht ladbar`;
  } else if (closures.length) {
    statusBadge.classList.add("alert");
    statusText.textContent = `${closures.length} Vollsperrung${closures.length > 1 ? "en" : ""} aktiv`;
  } else {
    statusBadge.classList.add("ok");
    statusText.textContent = `Keine Vollsperrung (${ROADS.length} Autobahnen überwacht)`;
  }
}

function renderClosures(closures) {
  closureList.innerHTML = "";
  noClosures.hidden = closures.length > 0;
  closures
    .sort((a, b) => a.road.localeCompare(b.road))
    .forEach((item) => closureList.appendChild(buildCard(item, "closure")));
}

function renderStauWarnungen(stauWarnungen) {
  stauList.innerHTML = "";
  noStau.hidden = stauWarnungen.length > 0;
  stauWarnungen
    .sort((a, b) => a.road.localeCompare(b.road))
    .forEach((item) => stauList.appendChild(buildCard(item, "stau")));
}

function renderOthers(others) {
  otherList.innerHTML = "";
  if (!others.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "Keine weiteren Meldungen Richtung Nürnberg gefunden.";
    otherList.appendChild(p);
    return;
  }

  ROADS.forEach((road) => {
    const roadItems = others.filter((item) => item.road === road);
    if (!roadItems.length) return;

    const details = document.createElement("details");
    details.className = "road-group";

    const summary = document.createElement("summary");
    summary.textContent = `${road} `;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = FEEDER_ROADS.includes(road)
      ? `(${roadItems.length} · beide Richtungen)`
      : `(${roadItems.length})`;
    summary.appendChild(count);
    details.appendChild(summary);

    const byLand = new Map();
    roadItems.forEach((item) => {
      const land = classifyBundesland(item);
      if (!byLand.has(land)) byLand.set(land, []);
      byLand.get(land).push(item);
    });

    BUNDESLAND_ORDER.forEach((land) => {
      const landItems = byLand.get(land);
      if (!landItems || !landItems.length) return;

      const landDetails = document.createElement("details");
      landDetails.className = "land-group";

      const landSummary = document.createElement("summary");
      landSummary.textContent = `${land} `;
      const landCount = document.createElement("span");
      landCount.className = "count";
      landCount.textContent = `(${landItems.length})`;
      landSummary.appendChild(landCount);
      landDetails.appendChild(landSummary);

      landItems.forEach((item) => landDetails.appendChild(buildRow(item)));
      details.appendChild(landDetails);
    });

    otherList.appendChild(details);
  });
}

function buildHideControl(item, hiddenView) {
  const label = document.createElement("label");
  label.className = "hide-control";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!hiddenView;
  checkbox.title = hiddenView
    ? "Wieder auf dem Hauptbildschirm anzeigen"
    : "Meldung ausblenden";
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", () => {
    setHidden(item, checkbox.checked);
  });
  label.appendChild(checkbox);

  const span = document.createElement("span");
  span.textContent = hiddenView ? "Ausgeblendet" : "Ausblenden";
  label.appendChild(span);

  return label;
}

function buildRow(item) {
  const row = document.createElement("div");
  row.className = "row";

  const rowMain = document.createElement("div");
  rowMain.className = "row-main";

  const toggle = document.createElement("button");
  toggle.className = "row-toggle";
  toggle.type = "button";

  const title = document.createElement("span");
  title.className = "row-title";
  title.textContent = item.title || "(ohne Titel)";
  toggle.appendChild(title);

  if (item.subtitle) {
    const subtitle = document.createElement("span");
    subtitle.className = "row-subtitle";
    subtitle.textContent = item.subtitle.trim();
    toggle.appendChild(subtitle);
  }

  rowMain.appendChild(toggle);
  rowMain.appendChild(buildHideControl(item, false));
  row.appendChild(rowMain);

  if (item.description && item.description.length) {
    const desc = document.createElement("div");
    desc.className = "row-desc";
    desc.textContent = item.description.filter(Boolean).join("\n");
    desc.hidden = true;
    row.appendChild(desc);

    toggle.addEventListener("click", () => {
      desc.hidden = !desc.hidden;
    });
  }

  return row;
}

function buildMapsButton(item) {
  const coord = itemCoord(item);
  if (!coord) return null;
  const link = document.createElement("a");
  link.className = "maps-btn";
  link.href = `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lon}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "📍 Auf Google Maps anzeigen";
  return link;
}

function buildCard(item, variant, hiddenView) {
  const card = document.createElement("div");
  card.className = `card${variant ? ` ${variant}` : ""}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const topLeft = document.createElement("div");
  topLeft.className = "card-top-left";

  const badge = document.createElement("span");
  badge.className = "road-badge";
  badge.textContent = item.road;
  topLeft.appendChild(badge);

  if (variant === "closure" || variant === "stau") {
    const mapsBtn = buildMapsButton(item);
    if (mapsBtn) topLeft.appendChild(mapsBtn);
  }

  top.appendChild(topLeft);
  top.appendChild(buildHideControl(item, hiddenView));

  card.appendChild(top);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.title || "(ohne Titel)";
  card.appendChild(title);

  if (item.subtitle) {
    const subtitle = document.createElement("div");
    subtitle.className = "card-subtitle";
    subtitle.textContent = item.subtitle.trim();
    card.appendChild(subtitle);
  }

  if (item.description && item.description.length) {
    const desc = document.createElement("div");
    desc.className = "card-desc";
    desc.textContent = item.description.filter(Boolean).join("\n");
    desc.hidden = true;
    card.appendChild(desc);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-desc";
    toggleBtn.textContent = "Details anzeigen";
    toggleBtn.addEventListener("click", () => {
      desc.hidden = !desc.hidden;
      toggleBtn.textContent = desc.hidden ? "Details anzeigen" : "Details ausblenden";
    });
    card.appendChild(toggleBtn);
  }

  return card;
}

refreshBtn.addEventListener("click", () => loadAll().catch(showFatalError));
allDirectionsToggle.addEventListener("change", () => render(lastItems, []));
tabMainBtn.addEventListener("click", () => {
  activeTab = "main";
  updateTabUI();
});
tabHiddenBtn.addEventListener("click", () => {
  activeTab = "hidden";
  updateTabUI();
});
centerFilter.addEventListener("change", () => {
  selectedCenter = centerFilter.value;
  refreshFilterOptions();
  updateFilterInfo();
  render(lastItems, []);
});
tourFilter.addEventListener("change", () => {
  selectedTour = tourFilter.value;
  refreshFilterOptions();
  updateFilterInfo();
  render(lastItems, []);
});
ortFilter.addEventListener("change", () => {
  selectedOrt = ortFilter.value;
  refreshFilterOptions();
  updateFilterInfo();
  render(lastItems, []);
});
resetFilterBtn.addEventListener("click", () => {
  selectedCenter = "";
  selectedTour = "";
  selectedOrt = "";
  refreshFilterOptions();
  updateFilterInfo();
  render(lastItems, []);
});

function showFatalError(err) {
  errorBanner.hidden = false;
  errorBanner.textContent = `Fehler beim Laden der Verkehrsdaten: ${err.message || err}`;
  setLoading(false);
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadAll().catch(showFatalError), REFRESH_INTERVAL_MS);
}

loadAll().catch(showFatalError);
startAutoRefresh();
