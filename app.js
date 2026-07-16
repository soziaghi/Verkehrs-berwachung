const ROADS = ["A3", "A9", "A6"];
const SERVICES = ["roadworks", "closure", "warning"];
const API_BASE = "https://verkehr.autobahn.de/o/autobahn";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const refreshBtn = document.getElementById("refreshBtn");
const refreshLabel = document.getElementById("refreshLabel");
const spinner = document.getElementById("spinner");
const lastUpdated = document.getElementById("lastUpdated");
const closureList = document.getElementById("closureList");
const otherList = document.getElementById("otherList");
const noClosures = document.getElementById("noClosures");
const errorBanner = document.getElementById("errorBanner");
const allDirectionsToggle = document.getElementById("allDirectionsToggle");
const roadStatus = document.getElementById("roadStatus");

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
  const relevant = showAllDirections ? items : items.filter(isDirectionNuernberg);

  const closures = relevant.filter(isVollsperrung);
  const others = relevant.filter((item) => !isVollsperrung(item));

  renderRoadStatus(closures, failures);
  renderClosures(closures);
  renderOthers(others);

  if (failures.length) {
    errorBanner.hidden = false;
    errorBanner.textContent = `Einige Daten konnten nicht geladen werden: ${failures.join(" · ")}`;
  }
}

function renderRoadStatus(closures, failures) {
  ROADS.forEach((road) => {
    const chip = roadStatus.querySelector(`[data-road="${road}"]`);
    chip.classList.remove("ok", "alert", "error");
    const hasFailure = failures.some((f) => f.startsWith(road));
    const hasClosure = closures.some((c) => c.road === road);
    if (hasFailure) chip.classList.add("error");
    else if (hasClosure) chip.classList.add("alert");
    else chip.classList.add("ok");
  });
}

function renderClosures(closures) {
  closureList.innerHTML = "";
  noClosures.hidden = closures.length > 0;
  closures
    .sort((a, b) => a.road.localeCompare(b.road))
    .forEach((item) => closureList.appendChild(buildCard(item, true)));
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
  others
    .sort((a, b) => a.road.localeCompare(b.road))
    .forEach((item) => otherList.appendChild(buildCard(item, false)));
}

function buildCard(item, isClosure) {
  const card = document.createElement("div");
  card.className = `card${isClosure ? " closure" : ""}`;

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
    desc.className = "card-desc collapsed";
    desc.textContent = item.description.filter(Boolean).join("\n");
    card.appendChild(desc);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-desc";
    toggleBtn.textContent = "Details anzeigen";
    toggleBtn.addEventListener("click", () => {
      const collapsed = desc.classList.toggle("collapsed");
      toggleBtn.textContent = collapsed ? "Details anzeigen" : "Details ausblenden";
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
