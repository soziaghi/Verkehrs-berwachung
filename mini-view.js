let miniWindow = null;
let lastMiniClosures = [];
let lastMiniStau = [];
let acknowledgedKey = "";

let blinkEnabled = true;
try {
  const stored = localStorage.getItem("miniBlinkEnabled");
  if (stored !== null) blinkEnabled = stored === "true";
} catch (err) {
  // localStorage kann in manchen Kontexten (z. B. privates Fenster) fehlschlagen.
}

const MINI_STYLES = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mini-bg: #171a21;
    background: var(--mini-bg);
    color: #e8eaed;
    font-size: 0.78rem;
  }
  @media (prefers-color-scheme: light) {
    body { --mini-bg: #ffffff; color: #1a1d23; }
  }
  @keyframes mini-blink {
    0%, 49% { background-color: #e5484d; }
    50%, 100% { background-color: var(--mini-bg); }
  }
  body.mini-blinking {
    animation: mini-blink 1s steps(1, end) infinite;
  }
  .mini-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    font-weight: 700;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(127,127,127,0.3);
    position: sticky;
    top: 0;
    background: inherit;
  }
  .mini-gear {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    opacity: 0.4;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    line-height: 1;
  }
  .mini-gear:hover { background: rgba(127,127,127,0.18); }
  .mini-gear.active { opacity: 1; }
  .mini-ack-bar {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    background: #2a0d0f;
    color: #ffb4b6;
    font-weight: 700;
    border-bottom: 2px solid #e5484d;
  }
  @media (prefers-color-scheme: light) {
    .mini-ack-bar { background: #fdecec; color: #a4232a; }
  }
  body.mini-blinking .mini-ack-bar { display: flex; }
  .mini-ack-btn {
    background: #e5484d;
    color: white;
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .mini-empty {
    padding: 0.6rem;
    color: #9aa0aa;
    font-style: italic;
  }
  .mini-item {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid rgba(127,127,127,0.15);
  }
  .mini-item.closure { background: rgba(229,72,77,0.12); border-left: 3px solid #e5484d; }
  .mini-item.stau { background: rgba(245,166,35,0.12); border-left: 3px solid #f5a623; }
  .mini-badge {
    display: inline-block;
    background: #4f8cff;
    color: white;
    font-weight: 700;
    font-size: 0.68rem;
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
    margin-right: 0.3rem;
  }
  .mini-title { font-weight: 600; }
  .mini-subtitle { color: #9aa0aa; font-size: 0.72rem; display: block; margin-top: 0.1rem; }
`;

function closureKey(closures) {
  return closures
    .map((c) => c.identifier || `${c.road}|${c.title}`)
    .sort()
    .join("~");
}

function gearTitle() {
  return blinkEnabled
    ? "Blinken bei Vollsperrung: an (klicken zum Ausschalten)"
    : "Blinken bei Vollsperrung: aus (klicken zum Einschalten)";
}

function buildMiniDocument(doc) {
  doc.title = "Autobahn-Überwachung · Mini";
  const style = doc.createElement("style");
  style.textContent = MINI_STYLES;
  doc.head.appendChild(style);

  const header = doc.createElement("div");
  header.className = "mini-header";

  const titleEl = doc.createElement("span");
  titleEl.textContent = "🚧 Vollsperrungen & Staus";
  header.appendChild(titleEl);

  const gear = doc.createElement("button");
  gear.type = "button";
  gear.className = `mini-gear${blinkEnabled ? " active" : ""}`;
  gear.textContent = "⚙️";
  gear.title = gearTitle();
  gear.addEventListener("click", () => {
    blinkEnabled = !blinkEnabled;
    try {
      localStorage.setItem("miniBlinkEnabled", String(blinkEnabled));
    } catch (err) {
      // ignore
    }
    gear.classList.toggle("active", blinkEnabled);
    gear.title = gearTitle();
    updateAlertState();
  });
  header.appendChild(gear);

  doc.body.appendChild(header);

  const ackBar = doc.createElement("div");
  ackBar.className = "mini-ack-bar";

  const ackText = doc.createElement("span");
  ackText.textContent = "Neue Vollsperrung!";
  ackBar.appendChild(ackText);

  const ackBtn = doc.createElement("button");
  ackBtn.type = "button";
  ackBtn.className = "mini-ack-btn";
  ackBtn.textContent = "✓ Gesehen";
  ackBtn.addEventListener("click", () => {
    acknowledgedKey = closureKey(lastMiniClosures);
    updateAlertState();
  });
  ackBar.appendChild(ackBtn);

  doc.body.appendChild(ackBar);

  const list = doc.createElement("div");
  list.id = "miniList";
  doc.body.appendChild(list);
}

function renderMiniItem(doc, item, variant) {
  const el = doc.createElement("div");
  el.className = `mini-item ${variant}`;

  const badge = doc.createElement("span");
  badge.className = "mini-badge";
  badge.textContent = item.road;
  el.appendChild(badge);

  const title = doc.createElement("span");
  title.className = "mini-title";
  title.textContent = item.title || "(ohne Titel)";
  el.appendChild(title);

  if (item.subtitle) {
    const sub = doc.createElement("span");
    sub.className = "mini-subtitle";
    sub.textContent = item.subtitle.trim();
    el.appendChild(sub);
  }

  return el;
}

function updateAlertState() {
  if (!miniWindow || miniWindow.closed) return;
  const doc = miniWindow.document;
  const key = closureKey(lastMiniClosures);
  const hasClosures = lastMiniClosures.length > 0;
  const shouldBlink = blinkEnabled && hasClosures && key !== acknowledgedKey;
  doc.body.classList.toggle("mini-blinking", shouldBlink);
}

function updateMiniView(closures, stauWarnungen) {
  lastMiniClosures = closures || [];
  lastMiniStau = stauWarnungen || [];
  if (!miniWindow || miniWindow.closed) return;

  const doc = miniWindow.document;
  const list = doc.getElementById("miniList");
  if (!list) return;
  list.innerHTML = "";

  if (!lastMiniClosures.length && !lastMiniStau.length) {
    const empty = doc.createElement("div");
    empty.className = "mini-empty";
    empty.textContent = "Keine Vollsperrung oder Stauwarnung.";
    list.appendChild(empty);
  } else {
    lastMiniClosures.forEach((item) => list.appendChild(renderMiniItem(doc, item, "closure")));
    lastMiniStau.forEach((item) => list.appendChild(renderMiniItem(doc, item, "stau")));
  }

  updateAlertState();
}

async function openMiniView() {
  if (miniWindow && !miniWindow.closed) {
    miniWindow.focus();
    return;
  }

  try {
    if (!("documentPictureInPicture" in window)) throw new Error("no-pip");
    miniWindow = await window.documentPictureInPicture.requestWindow({ width: 340, height: 420 });
  } catch (err) {
    miniWindow = window.open("", "AutobahnMiniAnsicht", "width=340,height=420,popup=yes");
  }

  if (!miniWindow) return;

  buildMiniDocument(miniWindow.document);
  miniWindow.addEventListener("pagehide", () => {
    miniWindow = null;
  });
  updateMiniView(lastMiniClosures, lastMiniStau);
}

document.getElementById("miniViewBtn").addEventListener("click", () => {
  openMiniView().catch((err) => console.error("Mini-Ansicht konnte nicht geöffnet werden:", err));
});
