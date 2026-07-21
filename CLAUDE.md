# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page web app ("Autobahn-Überwachung") that monitors 18 German
autobahns for full closures (Vollsperrungen), traffic jam warnings, and other
roadworks/warnings along the routes from 45 company locations to a fixed
destination (Koblenzerstr. 13, 90451 Nürnberg). UI text and code comments are
in German.

There is no build system, package manager, or test suite — plain HTML/CSS/JS
loaded directly by the browser via `<script>` tags in `index.html`.

## Running locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser. There is no build, lint, or
test command — verify changes by loading the page and checking behavior
manually in the browser (network calls, DOM updates, mini-view popup).

## Deployment

`.github/workflows/deploy-pages.yml` deploys the repo root straight to GitHub
Pages on every push to `claude/autobahn-monitoring-app-t6uqpc` (or manual
`workflow_dispatch`). There is no separate build step — the workflow uploads
the working tree as-is.

## Architecture

Four scripts loaded in order from `index.html`, each with a distinct role and
mostly communicating through DOM globals rather than modules/imports:

- **`config.js`** — `GOOGLE_MAPS_API_KEY` only. The key is intentionally
  public in client code; access is restricted via HTTP-referrer restriction
  in Google Cloud Console, not by secrecy.
- **`app.js`** — the core: fetches data, filters/classifies it, and renders
  the main page. Key pieces:
  - `ROADS` = `CORE_ROADS` (`A3`, `A6`, `A9`, `A73`, `A93`, which lead
    directly to Nürnberg) + `FEEDER_ROADS` (13 other autobahns needed to
    connect the 45 locations to the core roads, but too far from Nürnberg
    for direction text-matching to work).
  - For each road, all three `SERVICES` (`roadworks`, `closure`, `warning`)
    are fetched directly from the public Autobahn GmbH Open Data API
    (`https://verkehr.autobahn.de/o/autobahn/{road}/services/{service}`) —
    no backend proxy, CORS is open on that API.
  - `isDirectionNuernberg()` filters **core roads only** to the Nürnberg
    direction, via the `subtitle` "X -> Y" arrow format and a
    `/richtung n(ü|ue)rnberg/` regex over title/subtitle/description. Feeder
    roads always show both directions. The `allDirectionsToggle` checkbox
    disables this filter for core roads.
  - `isVollsperrung()` classifies an item as a full closure via the API's
    `isBlocked` field OR text patterns (`vollsperr`, `komplett/vollständig
    gesperrt`, `in beide richtungen gesperrt`) — the API has no dedicated
    "full closure" flag, so this is text heuristics.
  - `isStauWarnung()` similarly text-matches traffic-jam terms (`stau`,
    `staugefahr`, `zähfließend`, ...) on the same underlying data; the API
    has no structured jam length/duration field.
  - `classifyBundesland()` assigns each item to a German state by nearest
    centroid (`BUNDESLAND_CENTROIDS`) to its coordinate — an approximation,
    not real border polygons, deliberately avoiding extra geodata/APIs.
    `BUNDESLAND_ORDER` sorts states starting with Bavaria, then by distance
    from Nürnberg.
  - `render()` splits fetched items into three buckets in priority order:
    closures → Stauwarnungen → everything else, then calls
    `renderClosures`/`renderStauWarnungen`/`renderOthers` and, if defined,
    `updateMiniView()` (from `mini-view.js`) to keep the popup in sync.
    `renderOthers()` groups remaining items by road, then by Bundesland,
    as nested collapsible `<details>` elements.
  - Auto-refreshes every `REFRESH_INTERVAL_MS` (5 min) via
    `startAutoRefresh()`; manual refresh via the button. Failed per-road
    fetches (`Promise.allSettled`) degrade gracefully — other roads still
    render, and failures surface in `errorBanner` and the status badge.
- **`mini-view.js`** — the "📌 Mini-Ansicht" always-on-top popup. Uses the
  Document Picture-in-Picture API when available (Chrome/Edge), falling back
  to a plain `window.open()` popup otherwise (Firefox/Safari — no
  always-on-top). `app.js` calls `updateMiniView(closures, stauWarnungen)`
  after every render if the function exists, so this file must load after
  `app.js` but the two only interact through that one global function plus
  the module-scoped `lastMiniClosures`/`lastMiniStau`. Blink-on-new-closure
  state (`acknowledgedKey`, `blinkEnabled`) persists across popup
  open/close, with `blinkEnabled` stored in `localStorage`
  (`miniBlinkEnabled`).
- **`traffic-map.js`** — loads the Google Maps JS API asynchronously and
  renders a `TrafficLayer` centered on Nürnberg in `#trafficMap`. Fully
  independent of the other scripts; only reads `GOOGLE_MAPS_API_KEY` from
  `config.js`.

## Key conventions

- No frameworks, no bundler, no npm dependencies — keep it that way; all DOM
  building uses vanilla `document.createElement`.
- Full closure and traffic-jam detection are both **text heuristics** over
  API title/subtitle/description fields (see `isVollsperrung`/
  `isStauWarnung` in `app.js`), because the upstream API doesn't expose
  structured flags for either. When adjusting these patterns, keep them
  German-language and case-insensitive (`.toLowerCase()` before matching).
  Cross-check `README.md`'s "Funktionsweise" section, which documents the
  exact same rules in prose — update both together.
  - The `isBlocked` check accepts both the string `"true"` and boolean
    `true` since the API's typing is inconsistent.
- Core vs. feeder road distinction (`CORE_ROADS`/`FEEDER_ROADS` in
  `config.js`) is deliberate and documented in `README.md`; don't merge them
  or drop the asymmetric direction filtering without checking the README's
  rationale first.
- Bundesland classification is a nearest-centroid approximation, not exact
  geodata — don't try to "fix" it into a precise implementation without
  discussing, since avoiding extra geodata/API dependencies is intentional.
- UI copy is German; match existing tone/terminology when adding strings.
