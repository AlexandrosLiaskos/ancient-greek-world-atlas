# Ancient Greek World Atlas — WebGIS Design Specification

**Status:** Approved for implementation  
**Date:** 2026-08-15  
**Phase:** Static bilingual WebGIS

## 1. Objective

Turn the reviewed Ancient Greek World Atlas data release into a fast, bilingual, editorial WebGIS for GitHub Pages. The interface should inherit the strongest spatial and editorial patterns of the Lagoons reference while remaining purpose-built for the atlas's 226 settlements, sanctuaries, and polities.

The application must work without Supabase, authentication, a server runtime, or a remote database. Checked-in static data is the runtime source. Greek is the default and authoritative public language, with a complete English interface available at any time.

## 2. Chosen approach

Use a static, modular application built with semantic HTML, CSS, native ES modules, Leaflet, and Leaflet.markercluster. This approach is preferred over both a reduced map-only catalogue and a React/Vite application because it preserves the full workbench experience without adding a framework, deployment runtime, or unnecessary bundle overhead.

The application will have no mandatory build step. Development scripts may validate, test, and serve the repository, but the deployed site must consist of path-safe static files that GitHub Pages can serve directly.

## 3. Experience principles

1. **The map and catalogue are peers.** The map supplies geographic context; the catalogue supplies legibility, scanning, and keyboard access.
2. **Clusters count; markers classify.** Cluster labels show the number of grouped records. Individual markers never show catalogue numbers and instead communicate entity class through shape and colour.
3. **Uncertainty stays visible.** Proxies, representative centres, medium-confidence records, and approximate dates are explained rather than presented as exact facts.
4. **Greek must feel native.** Greek is not a translated afterthought: typography, line lengths, labels, sorting, search, and date wording must work naturally in Greek.
5. **Progressive disclosure limits clutter.** Common browsing actions are immediate; detailed scholarly information appears in the record view.
6. **Mobile preserves both contexts.** The catalogue remains usable in a tall bottom sheet while the map stays visible behind it.
7. **No decorative filler.** The first release does not fabricate imagery, hotlink media, or display empty gallery placeholders.

## 4. Information architecture

### 4.1 Global masthead

The compact masthead contains:

- the bilingual project title, with Greek shown by default;
- a Greek/English language switch;
- a concise About/help action;
- no eyebrow, redundant subtitle, or duplicate catalogue label.

The title uses an expressive Greek-capable display face balanced by restrained editorial body and interface typography. Thin rules, high-contrast type, quiet surfaces, and limited accent colour establish continuity with Lagoons without copying its interface mechanically.

### 4.2 Desktop workbench

Desktop uses a fixed workbench of approximately 400 pixels beside a flexible map. Its four top-level views are:

1. **Catalogue** — the default view and complete filtered result list;
2. **Filters** — faceted discovery with active-filter chips;
3. **Search** — bilingual full-corpus search and ranked results;
4. **Statistics** — live distributions derived from the current result set.

The workbench header and tab controls remain visible while the active panel scrolls internally. The map remains the dominant canvas and does not jump when panels change.

### 4.3 Mobile workbench

Mobile uses a persistent bottom action bar for Catalogue, Filters, Search, and Statistics. Activating an action opens a bottom sheet between roughly 74 and 82 dynamic viewport height, with:

- a visible drag handle and close control;
- a sticky panel header;
- independent internal scrolling;
- safe-area spacing;
- focus containment and Escape/back-button support.

The map remains visible above and behind the sheet. Selecting a record may collapse the sheet to reveal the marker, while an explicit Details action opens the full record view.

## 5. Catalogue and record discovery

### 5.1 Catalogue

The catalogue header shows the filtered count and a reset action only when filters or a query are active. Each compact result contains:

- preferred name in the active language;
- ancient or alternate name when useful;
- entity class and editorial collection;
- modern locality/country and concise chronology;
- an uncertainty cue where the location is a proxy or representative centre.

Hovering or focusing a result previews its marker. Selecting it flies the map to the record and opens a compact map preview. A separate action opens the full record view. Sorting is deterministic and locale-aware, with relevance ordering during search.

### 5.2 Filters

The default filter surface follows the compact Lagoons variable-picker pattern instead of presenting many large control groups simultaneously. Supported facets are:

- entity class: settlement, sanctuary, polity;
- editorial collection: city, colony, sanctuary, kingdom/polity;
- modern country;
- ancient region;
- chronology, using a dual-ended signed-year range;
- record confidence;
- geometry role: site, proxy, representative centre.

Categorical facets support multi-select, a searchable option list, per-option result counts, and a clear-current-facet action. Active filters appear as removable chips. A pinned footer provides Reset and Show results actions. Options with zero matches remain legible but disabled where appropriate.

All facets combine through one client-side filter pipeline. Counts are calculated from the data remaining after the other active facets, so the interface helps the user understand viable combinations.

### 5.3 Search

Search is accent-insensitive and case-insensitive. It covers:

- Greek and English preferred names;
- Ancient Greek, modern, transliterated, and alternative names;
- modern locality and country;
- ancient region;
- descriptions and controlled classification labels.

Name matches rank above location and description matches. Matching text is highlighted without altering the source data. Search and filters compose rather than replacing one another.

### 5.4 Statistics

Statistics summarize the current filtered set, not only the full corpus. The first release includes compact, accessible distributions for:

- entity class;
- editorial collection;
- modern country;
- broad chronological period;
- geometry role and confidence.

Bars expose exact values in text and may be selected to apply the corresponding filter. The view avoids a general-purpose query builder or heavyweight charting dependency.

## 6. Map behaviour

### 6.1 Symbols and clusters

All 226 public geometries remain point features. The map does not invent regional or political boundary polygons.

Individual symbols are visually distinct by canonical entity class:

- settlement: circle;
- sanctuary: diamond;
- polity: square.

Colour reinforces but never solely carries the distinction. Proxy and representative-centre points receive a secondary visual treatment and an explanatory accessible label. Marker symbols do not contain ordinal numbers.

Clusters display only the number of contained visible records. Cluster appearance scales by count while remaining visually distinct from individual symbols. Spiderfying and zoom-to-bounds support dense locations.

### 6.2 Map chrome

The map includes:

- zoom and reset-extent controls;
- a restrained basemap switcher for a neutral light map and OpenStreetMap;
- an in-map collapsible legend with live filtered counts;
- a status strip showing visible/total records and pointer coordinates on capable devices;
- attribution that remains readable on mobile;
- a loading state and explicit map error state.

The legend explains entity-class symbols, cluster counts, and spatial uncertainty. It is part of the map rather than a detached sidebar section.

### 6.3 Preview and selection

Marker hover or keyboard focus shows a bounded compact preview containing name, class, place, date, confidence/geometry cue, and Details action. Previews are clamped inside the map viewport. Touch selection opens the same information without requiring hover.

Only one entity is selected at a time. Selection is synchronized across map, catalogue, URL, and full record view.

## 7. Full record view

The detail experience is a full-height dialog on desktop and a full-screen sheet on mobile. It includes:

- preferred Greek and English names and supported ancient names;
- canonical class, subtype, and collection membership;
- bilingual editorial description;
- chronological assertions with qualifiers and precision;
- modern locality, country, ancient region, coordinates, and spatial role;
- typed relationships with links to atlas entities where targets exist;
- source support grouped by claim type;
- external identifiers, including a direct Pleiades link where available;
- confidence and editorial review metadata.

Coordinates include a copy action and source context. BCE/CE wording is localized rather than exposing signed storage years. Relations to another mapped record navigate in place and preserve a usable browser history.

The first release is deliberately image-free. Media can be added later only through a licensed, source-attributed media model; until then, the detail view remains a complete typographic scholarly record with no empty gallery area.

## 8. Language and date handling

Greek loads by default on a first visit. The language switch changes all interface labels, controlled vocabulary labels, descriptions, date labels, empty states, accessibility text, and metadata without reloading the page.

Language preference is encoded in the URL and may also be remembered locally. URL state takes precedence when a shared link is opened. Missing localized optional values fall back explicitly and never produce blank controls.

Year formatting rules are centralized:

- negative years display as π.Χ. / BCE;
- positive years display as μ.Χ. / CE where the era is needed;
- approximate and bounded qualifiers remain visible;
- year zero is never rendered.

## 9. State and URL contract

A single application store owns:

- active language and workbench tab;
- search query and active facets;
- selected entity;
- map centre, zoom, and basemap;
- mobile sheet state.

Derived selectors produce filtered entities, facet counts, map features, catalogue rows, and statistics. Components never maintain competing copies of filter results.

Shareable URL parameters cover language, active tab, query, filters, selected entity, map centre, and zoom. State changes use history replacement for continuous map movement and history entries for meaningful navigation such as opening a record. Browser Back and Forward restore the corresponding interface state.

## 10. Data flow and technical architecture

At startup the application loads the checked-in `dist/ancient-greek-world.json`. A small adapter validates the release metadata and converts canonical entities into immutable view records. Map geometry comes from the entity place assertions in the same release, preventing JSON and GeoJSON from drifting at runtime.

The proposed frontend structure is:

```text
index.html
assets/
  fonts/
  icons/
  styles/
    tokens.css
    base.css
    layout.css
    components.css
    responsive.css
src/web/
  app.js
  data.js
  state.js
  url-state.js
  i18n.js
  filters.js
  search.js
  statistics.js
  map.js
  catalogue.js
  details.js
  render.js
tests/web/
```

Modules communicate through the central store and explicit render/update functions. The application does not reproduce the much larger Lagoons event/module surface because the atlas has a small immutable static corpus and no server synchronization.

## 11. Loading, empty, and failure states

- Initial loading uses a lightweight skeleton and status message rather than an empty white panel.
- A zero-result state explains that the dataset loaded correctly and offers Reset filters.
- A failed data request shows a bilingual actionable error and preserves the application shell.
- A failed map library or tile request does not make the catalogue and record details unusable.
- Unsupported or stale URL parameters are ignored individually and normalized without preventing startup.
- External source links open safely and are visually distinguished from internal entity navigation.

## 12. Accessibility

- Semantic landmarks, headings, lists, buttons, and dialogs are used before ARIA additions.
- Every action is keyboard operable and has a visible focus state.
- Catalogue focus and map selection synchronize without stealing focus unexpectedly.
- Dialogs and mobile sheets manage focus and return it to the invoking control.
- Colour contrast meets WCAG AA, and shapes/text supplement colour coding.
- Reduced-motion preferences remove nonessential transitions and map animation.
- Result counts and filter changes are announced through a restrained live region.
- Touch targets are at least 44 by 44 CSS pixels on mobile.

## 13. Performance and deployment

The 226-record corpus is loaded once and filtered in memory. No list virtualization, web worker, or remote cache is required at this scale. Search normalization is precomputed once after load. Marker clustering limits map DOM pressure.

The deployed site must:

- work under a GitHub Pages project subpath;
- avoid root-relative asset and data URLs;
- have no required environment variables or secrets;
- load its critical interface before optional map tiles;
- use locally hosted project fonts where licensing permits;
- avoid runtime analytics and third-party media requests in the first release.

## 14. Verification and release gates

Automated tests cover:

- data adaptation and release compatibility;
- bilingual fallback and year formatting;
- accent-insensitive multilingual search and ranking;
- every filter type and combined filters;
- facet counts and statistics;
- URL serialization, parsing, and browser-state restoration;
- selected-record and relation navigation;
- safe rendering of user-visible dataset text.

Browser verification covers desktop and mobile layouts, keyboard navigation, dialog focus, bottom-sheet usability, marker/cluster semantics, filter/search composition, browser history, console errors, and GitHub Pages subpath loading.

Release is blocked by broken internal links, missing public translations, a blank catalogue after a recoverable map error, inaccessible primary controls, individual numbered markers, incorrect cluster counts, or deployment paths that only work at localhost root.

## 15. Explicit non-goals

- no Supabase, server database, authentication, or editing interface;
- no territorial or regional polygons in this release;
- no invented historical boundaries;
- no image scraping, unlicensed media, or placeholder galleries;
- no measurement, drawing, or general GIS analysis toolkit;
- no general-purpose statistical query builder;
- no frontend framework unless a verified implementation constraint later requires one.

