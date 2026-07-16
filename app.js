// Kern-Autobahnen: führen direkt auf Nürnberg zu, "Richtung Nürnberg"-Textfilter bleibt aktiv.
const CORE_ROADS = ["A3", "A6", "A9", "A73", "A93"];
// Zubringer-Autobahnen: liegen zu weit von Nürnberg entfernt für einen Richtungs-Textfilter,
// daher werden hier beide Richtungen angezeigt.
const FEEDER_ROADS = ["A1", "A2", "A4", "A5", "A7", "A8", "A13", "A71", "A81", "A92", "A95", "A99", "A113"];
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

let refreshTimer = null;
let lastItems = [];

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

  const closures = relevant.filter(isVollsperrung);
  const remaining = relevant.filter((item) => !isVollsperrung(item));
  const stauWarnungen = remaining.filter(isStauWarnung);
  const others = remaining.filter((item) => !isStauWarnung(item));

  renderStatusBadge(closures, failures);
  renderClosures(closures);
  renderStauWarnungen(stauWarnungen);
  renderOthers(others);

  if (failures.length) {
    errorBanner.hidden = false;
    errorBanner.textContent = `Einige Daten konnten nicht geladen werden: ${failures.join(" · ")}`;
  }
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

    roadItems.forEach((item) => details.appendChild(buildRow(item)));
    otherList.appendChild(details);
  });
}

function buildRow(item) {
  const row = document.createElement("div");
  row.className = "row";

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

  row.appendChild(toggle);

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

function buildCard(item, variant) {
  const card = document.createElement("div");
  card.className = `card${variant ? ` ${variant}` : ""}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const title = document.createElement("div");
  title.className = "card-title";
  const badge = document.createElement("span");
  badge.className = "road-badge";
  badge.textContent = item.road;
  title.appendChild(badge);
  title.appendChild(document.createTextNode(item.title || "(ohne Titel)"));
  top.appendChild(title);

  card.appendChild(top);

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
