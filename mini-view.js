let miniWindow = null;
let lastMiniClosures = [];
let lastMiniStau = [];

const MINI_STYLES = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #171a21;
    color: #e8eaed;
    font-size: 0.78rem;
  }
  @media (prefers-color-scheme: light) {
    body { background: #ffffff; color: #1a1d23; }
  }
  .mini-header {
    padding: 0.5rem 0.6rem;
    font-weight: 700;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(127,127,127,0.3);
    position: sticky;
    top: 0;
    background: inherit;
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

function buildMiniDocument(doc) {
  doc.title = "Autobahn-Überwachung · Mini";
  const style = doc.createElement("style");
  style.textContent = MINI_STYLES;
  doc.head.appendChild(style);

  const header = doc.createElement("div");
  header.className = "mini-header";
  header.textContent = "🚧 Vollsperrungen & Staus";
  doc.body.appendChild(header);

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
    return;
  }

  lastMiniClosures.forEach((item) => list.appendChild(renderMiniItem(doc, item, "closure")));
  lastMiniStau.forEach((item) => list.appendChild(renderMiniItem(doc, item, "stau")));
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
