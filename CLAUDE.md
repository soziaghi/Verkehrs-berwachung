# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, client-only web app (no build step, no server, no package.json) that
monitors 18 German Autobahn routes for full closures (Vollsperrungen), traffic
jam warnings (Stauwarnungen), and other roadworks/warnings, on the way from 45
company locations to a single destination (Koblenzerstr. 13, 90451 Nürnberg).
It calls the public Autobahn GmbH Open Data API directly from the browser
(CORS-enabled, no proxy needed) and overlays a Google Maps traffic layer.

All UI text, comments, and commit-facing content in this repo is German;
match that when editing existing strings/comments.

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly (`file://`) also works since there's no build
step. There is no test suite, linter, or package manager in this repo —
verify changes by loading the page in a browser and checking the console/network
tab, not by running a command.

## Deployment

`.github/workflows/deploy-pages.yml` deploys the repo root straight to GitHub
Pages on push to `claude/autobahn-monitoring-app-t6uqpc` (or manual
`workflow_dispatch`). There is no build/artifact step — the static files are
uploaded as-is.

## Architecture

Four plain `<script>` files loaded in order from `index.html`, sharing global
scope (no modules/bundler):

1. **`config.js`** — just the Google Maps API key constant
   (`GOOGLE_MAPS_API_KEY`). The key is meant to be public; it's restricted via
   HTTP-referrer restriction in Google Cloud Console, not by secrecy.
2. **`app.js`** — the core: fetches, classifies, and renders everything except
   the mini-view and the Google map.
3. **`mini-view.js`** — the always-on-top "Mini-Ansicht" popup, driven by data
   `app.js` pushes into it.
4. **`traffic-map.js`** — loads the Google Maps JS API and draws the traffic
   layer.

### Data flow (`app.js`)

- `ROADS` = `CORE_ROADS` (`A3`, `A6`, `A9`, `A73`, `A93` — routes that lead
  directly into Nürnberg) concatenated with `FEEDER_ROADS` (13 other
  Autobahnen needed to connect the 45 locations to the core roads, but too far
  from Nürnberg for their direction text to ever say "Nürnberg").
- `loadAll()` fires `Promise.allSettled` across every `(road, service)` pair
  for `SERVICES = ["roadworks", "closure", "warning"]` against
  `https://verkehr.autobahn.de/o/autobahn/{road}/services/{service}`, tags
  each item with `{road, service}`, then calls `render()`.
- `render()` is the single place that turns the raw item list into what's on
  screen. Filtering/classification order matters and is intentionally
  layered:
  1. Direction filter: for `CORE_ROADS` only (unless the "auch Gegenrichtung"
     toggle is checked), keep items where `isDirectionNuernberg()` matches —
     via the `subtitle` arrow format (`"X -> Nürnberg"`) or a
     `richtung nürnberg` regex over title/subtitle/description. Feeder roads
     always show both directions.
  2. `isVollsperrung()` — API's `isBlocked` flag OR text regexes
     (`vollsperr`, `komplett/vollständig gesperrt`, `in beide richtungen
     gesperrt`) — there's no dedicated closure flag from the API, so this is
     text detection over title/subtitle/description.
  3. Of what's left, `isStauWarnung()` — text regex for
     `stau|staugefahr|stockender verkehr|zähfließend/zaehfliessend|verkehr
     staut` — pulls out congestion warnings into their own section. The API
     has no structured jam length/duration; this is purely text matching over
     the same roadworks/warning data.
  4. Everything remaining is "Weitere Meldungen", grouped first by `road`
     (in `ROADS` order) then by German state (`classifyBundesland()`), via
     nested `<details>` elements.
- `classifyBundesland()` assigns each item to the nearest entry in
  `BUNDESLAND_CENTROIDS` (a hardcoded lat/lon per state) using
  `distanceKm()`'s flat-earth approximation — deliberately not exact
  polygon-based, since the app avoids extra geodata/APIs. `BUNDESLAND_ORDER`
  always starts with Bayern (contains the destination), then the rest sorted
  by distance from Nürnberg.
- After `render()`, `updateMiniView(closures, stauWarnungen)` is called if
  defined (i.e. if `mini-view.js` loaded) — this is the only coupling point
  between the two files, no event bus or shared module.
- Auto-refresh every 5 minutes (`REFRESH_INTERVAL_MS`) plus a manual
  "Aktualisieren" button; toggling "auch Gegenrichtung" re-renders
  `lastItems` without refetching.

### Mini-view (`mini-view.js`)

- Opens via the **Document Picture-in-Picture API** when available (stays
  on top of other windows/apps in Chrome/Edge); falls back to a plain
  `window.open()` popup otherwise (no always-on-top behavior, e.g.
  Firefox/Safari).
- Styles are injected as a template string (`MINI_STYLES`) into the popup's
  own document, since it's a separate `document`/`window`, not a DOM subtree
  of the main page — regular `styles.css` doesn't apply there.
- Blinking-on-new-closure state: `closureKey()` derives a stable identity
  from the current closures (`identifier` or `road|title`, sorted, joined).
  Blinking is active whenever `blinkEnabled && hasClosures && key !==
  acknowledgedKey`. Clicking "✓ Gesehen" sets `acknowledgedKey` to the
  current key; a genuinely new/different closure set changes the key and
  resumes blinking even if a previous one was acknowledged. The gear icon
  toggles `blinkEnabled` globally and persists it to
  `localStorage["miniBlinkEnabled"]`.

### Traffic map (`traffic-map.js`)

Loads the Google Maps JS API asynchronously with `GOOGLE_MAPS_API_KEY` from
`config.js`, centers on Nürnberg, and overlays `google.maps.TrafficLayer()`.
This only shows color-coded congestion intensity — no clickable
closure/incident details — so the Vollsperrung list above remains the
authoritative source.

## Conventions to preserve when editing

- No build tooling, no dependencies, no framework — keep new code as plain
  DOM-manipulating JS consistent with the existing style (manual
  `createElement`/`textContent`, no innerHTML with untrusted data).
- Detection logic (Vollsperrung/Stau/direction) is text-pattern-based because
  the upstream API doesn't expose these as structured fields; when adjusting
  patterns, keep matching case-insensitive over
  `title + subtitle + description.join(" ")`.
- Which Autobahn(en) serve which of the 45 company locations was worked out
  and confirmed with the user in the original route review — don't
  re-derive `ROADS`/`CORE_ROADS`/`FEEDER_ROADS` membership without checking
  the intent in README.md first.
