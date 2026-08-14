# Ancient Greek World Atlas Static WebGIS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a fast, bilingual, source-rich WebGIS for the 226 reviewed Ancient Greek World Atlas entities.

**Architecture:** A static semantic HTML/CSS application loads the checked-in JSON release, adapts it into immutable browser view records, and derives search, filters, statistics, catalogue, map, and detail views from one central state store. Native ES modules own pure domain logic while a small Leaflet controller owns map-specific side effects; GitHub Pages serves the repository directly without a backend or mandatory build step.

**Tech Stack:** HTML5, CSS, native JavaScript ES modules, Node.js built-in test runner, html-validate 11.6.2, Playwright 1.62.1, Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Python unittest data suite, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-15-ancient-greek-world-webgis-design.md`

## Global Constraints

- Repository instructions prohibit subagents; execute this plan inline with `superpowers:executing-plans`.
- Greek is the default and authoritative interface language; every public control and state also has English copy.
- Runtime data comes from `./dist/ancient-greek-world.json`; there is no Supabase, authentication, server runtime, or remote application database.
- All 226 geometries remain points; do not invent region or polity polygons.
- Cluster labels are counts; individual markers never contain catalogue numbers.
- The site must work from a GitHub Pages project subpath, so runtime resources use document-relative URLs.
- The first release contains no image gallery, hotlinked media, analytics, secrets, or environment variables.
- Changes follow test-driven development, keep the existing 51-test data suite green, and use small intentional commits.

---

## Planned file structure

```text
.github/workflows/pages.yml       GitHub Pages verification and deployment
assets/fonts/                     Licensed GFS Solomos display font and licence
assets/styles/tokens.css          Colour, type, size, spacing, and motion tokens
assets/styles/base.css            Reset, typography, focus, buttons, form controls
assets/styles/layout.css          Masthead, workbench, map, dialog, and sheet layout
assets/styles/components.css      Catalogue, facets, statistics, markers, previews
assets/styles/responsive.css      Tablet/mobile layout and reduced-motion rules
index.html                        Semantic static application shell
package.json                      Reproducible web validation and local-server scripts
src/web/app.js                    Startup, event wiring, effects, and render scheduling
src/web/catalogue.js              Catalogue view model and DOM renderer
src/web/data.js                   Release validation and browser-record adaptation
src/web/details.js                Record detail view model and dialog renderer
src/web/filters.js                Facet matching, contextual counts, and year overlap
src/web/i18n.js                   Interface messages, localized values, dates, sorting
src/web/map.js                    Leaflet controller and pure marker descriptors
src/web/render.js                 Shared shell, tabs, filter/search/statistics rendering
src/web/search.js                 Normalization, index construction, scoring, highlights
src/web/state.js                  Immutable reducer, store, defaults, derived selection
src/web/statistics.js             Current-result distributions and chronology buckets
src/web/url-state.js              URL parse/serialize and history intent
tests/e2e/atlas.spec.mjs          Browser-level desktop/mobile/accessibility smoke checks
tests/web/dom-fixture.js           Minimal deterministic DOM used by unit tests
tests/web/*.test.js               Node unit and contract tests for browser modules
```

---

### Task 1: Static application shell and visual foundation

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `assets/styles/tokens.css`
- Create: `assets/styles/base.css`
- Create: `assets/styles/layout.css`
- Create: `assets/styles/components.css`
- Create: `assets/styles/responsive.css`
- Copy: `assets/fonts/gfs-solomos.woff2`
- Copy: `assets/fonts/OFL-GFS-Solomos.txt`
- Create: `tests/web/structure.test.js`

**Interfaces:**
- Consumes: `dist/ancient-greek-world.json`, Leaflet globals `window.L` and `L.markerClusterGroup`.
- Produces: stable DOM IDs used by all later renderers: `app`, `masthead-title`, `language-toggle`, `about-button`, `workbench`, `tool-tabs`, `panel-catalogue`, `panel-filters`, `panel-search`, `panel-statistics`, `result-list`, `map`, `map-legend`, `map-status`, `mobile-actions`, `record-dialog`, `about-dialog`, `app-status`.

- [ ] **Step 1: Create a failing structural contract test**

```js
// tests/web/structure.test.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('shell exposes every application mount point', () => {
  for (const id of [
    'app', 'masthead-title', 'language-toggle', 'workbench', 'tool-tabs',
    'panel-catalogue', 'panel-filters', 'panel-search', 'panel-statistics',
    'result-list', 'map', 'map-legend', 'map-status', 'mobile-actions',
    'record-dialog', 'about-dialog', 'app-status',
  ]) assert.match(html, new RegExp(`id=["']${id}["']`), id);
});

test('runtime paths are GitHub Pages subpath safe', () => {
  assert.doesNotMatch(html, /(?:src|href)=["']\/(?!\/)/);
  assert.match(html, /src=["']\.\/src\/web\/app\.js["']/);
  assert.match(html, /\.\/dist\/ancient-greek-world\.json/);
});
```

- [ ] **Step 2: Run the contract test and confirm the shell is absent**

Run: `node --test tests/web/structure.test.js`  
Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Add the package scripts, semantic shell, and licensed title font**

`package.json` must declare `"type": "module"` and these scripts:

```json
{
  "scripts": {
    "test:web": "node --test tests/web/*.test.js",
    "test:data": "python -m unittest discover -s tests -v",
    "validate:html": "html-validate index.html",
    "test": "npm run test:web && npm run test:data && npm run validate:html",
    "serve": "npx --yes serve . -l 4173"
  },
  "devDependencies": { "html-validate": "11.6.2" }
}
```

Create `index.html` with the mount points in the interface block, tab semantics, catalogue as the initially active tab, a no-script message, document-relative CSS/data/module references, Leaflet 1.9.4 and MarkerCluster 1.5.3 CDN assets, and integrity/crossorigin attributes wherever the provider publishes an integrity value. Copy only the font and OFL licence from the Wonders repository:

```powershell
New-Item -ItemType Directory -Force assets/fonts | Out-Null
Copy-Item -LiteralPath '..\Ancient Greek Wonders\assets\fonts\gfs-solomos.woff2' -Destination 'assets\fonts\gfs-solomos.woff2'
Copy-Item -LiteralPath '..\Ancient Greek Wonders\assets\fonts\OFL-GFS-Solomos.txt' -Destination 'assets\fonts\OFL-GFS-Solomos.txt'
```

- [ ] **Step 4: Implement the editorial design tokens and responsive shell**

Define the exact core variables in `tokens.css` and use them throughout the remaining stylesheets:

```css
:root {
  --paper: #f5f1e8;
  --surface: #fffdf8;
  --ink: #191814;
  --muted: #68645b;
  --rule: #c9c1b2;
  --accent: #1f6248;
  --settlement: #245f8f;
  --sanctuary: #9a542e;
  --polity: #665095;
  --danger: #9d342b;
  --sidebar-width: 25rem;
  --masthead-height: 5.5rem;
  --ui-font: Inter, Arial, sans-serif;
  --editorial-font: Georgia, 'Times New Roman', serif;
  --title-font: 'GFS Solomos', Georgia, serif;
  --focus-ring: 0 0 0 3px rgb(31 98 72 / 28%);
}
```

Desktop uses a fixed workbench plus flexible map; mobile under `760px` uses a full map, persistent action bar, and workbench bottom sheet. Include visible `:focus-visible`, `prefers-reduced-motion`, `100dvh`, safe-area insets, 44px mobile targets, and map/dialog layers with explicit z-index tokens.

- [ ] **Step 5: Install, validate, and commit the shell**

Run: `npm install`  
Run: `npm run test:web`  
Run: `npm run validate:html`  
Expected: all structural tests and HTML validation pass.

```powershell
git add package.json package-lock.json index.html assets tests/web/structure.test.js
git commit -m "feat: establish static atlas shell"
```

---

### Task 2: Release adapter and bilingual formatting

**Files:**
- Create: `src/web/data.js`
- Create: `src/web/i18n.js`
- Create: `tests/web/data.test.js`
- Create: `tests/web/i18n.test.js`

**Interfaces:**
- Consumes: release shape `{ dataset, entities, authorities, sources }` from `dist/ancient-greek-world.json`.
- Produces: `adaptRelease(payload): AtlasModel`, `loadAtlas(fetchImpl?, url?): Promise<AtlasModel>`, `formatYear(year, lang): string`, `formatDateRange(chronology, lang): string`, `message(lang, key, vars?): string`, `localized(pair, lang): string`, `localeFor(lang): string`.
- `AtlasModel` is `{ dataset, entities, entitiesById, authoritiesById, extent, yearExtent }`.
- Each adapted entity is `{ id, entityClass, subtype, collections, name, description, ancientName, aliases, region, place, chronologies, startYear, endYear, relationships, sources, externalIds, confidence, reviewState }`.

- [ ] **Step 1: Write failing adapter and language tests**

```js
test('adaptRelease resolves region labels and preserves spatial semantics', () => {
  const model = adaptRelease(fixtureRelease);
  assert.equal(model.entities[0].name.el, 'Αίγινα');
  assert.equal(model.entities[0].region.en, 'Saronic Gulf');
  assert.equal(model.entities[0].place.geometryRole, 'site');
  assert.deepEqual(model.extent, [[37.75, 23.42], [37.75, 23.42]]);
});

test('Greek and English year labels never render year zero', () => {
  assert.equal(formatYear(-447, 'el'), '447 π.Χ.');
  assert.equal(formatYear(161, 'en'), '161 CE');
  assert.throws(() => formatYear(0, 'el'), /year zero/i);
});
```

Use compact fixtures that include one authority, one entity, one place, one chronology, one relation, and one source rather than loading the full distribution for unit assertions. Add one integration assertion against the real release for 226 entities and year extent `[-2000, 700]`.

- [ ] **Step 2: Run the tests and confirm missing exports**

Run: `node --test tests/web/data.test.js tests/web/i18n.test.js`  
Expected: FAIL with module-not-found for `data.js` and `i18n.js`.

- [ ] **Step 3: Implement strict release adaptation**

`adaptRelease` must reject a missing dataset object, non-array entities, duplicate IDs, records without a usable point, and records without Greek/English preferred names. Split pipe-delimited collection fields, resolve ancient-region authorities, deduplicate sources by `source_id`, compute `[southWest, northEast]` extent, and freeze the top-level arrays and records used by selectors.

```js
export async function loadAtlas(fetchImpl = fetch, url = './dist/ancient-greek-world.json') {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Atlas data request failed: ${response.status}`);
  return adaptRelease(await response.json());
}
```

- [ ] **Step 4: Implement complete UI messages and localized formatters**

`i18n.js` must include Greek and English copy for global actions, tabs, count grammar, filters, empty/error states, legend, confidence/geometry explanations, details sections, source labels, About content, and mobile controls. `message` throws on an unknown key in tests and returns interpolated copy for `{count}`. `localized({el,en}, lang)` uses the requested non-empty value then the other language; it never returns `undefined`.

- [ ] **Step 5: Run adapter tests and commit**

Run: `node --test tests/web/data.test.js tests/web/i18n.test.js`  
Expected: PASS, including the real 226-entity release assertion.

```powershell
git add src/web/data.js src/web/i18n.js tests/web/data.test.js tests/web/i18n.test.js
git commit -m "feat: adapt bilingual atlas release"
```

---

### Task 3: Search, filter, and statistics domain engine

**Files:**
- Create: `src/web/search.js`
- Create: `src/web/filters.js`
- Create: `src/web/statistics.js`
- Create: `tests/web/search.test.js`
- Create: `tests/web/filters.test.js`
- Create: `tests/web/statistics.test.js`

**Interfaces:**
- Consumes: adapted entities from Task 2 and filter state from Task 4.
- Produces: `normalizeSearchText(value): string`, `createSearchIndex(entities): SearchIndex`, `search(index, query): Map<string, number>`, `highlightRanges(text, query): Array<[number, number]>`, `filterEntities(entities, filterState, scores?): Entity[]`, `getFacetOptions(entities, filterState, facet, lang): FacetOption[]`, `countActiveFilters(filterState): number`, `buildStatistics(entities, lang): StatisticsModel`.
- `filterState` is `{ facets: Record<FacetName, string[]>, years: { min: number, max: number } }`.

- [ ] **Step 1: Write failing multilingual search tests**

```js
test('search ignores Greek accents and ranks names above descriptions', () => {
  const index = createSearchIndex(fixtures);
  const scores = search(index, 'Αθηναι');
  assert.ok(scores.get('athens') > scores.get('other-record'));
});

test('search finds ancient, transliterated, locality, and region names', () => {
  const scores = search(createSearchIndex(fixtures), 'Athenae');
  assert.ok(scores.has('athens'));
});
```

Normalization uses Unicode NFD, removes combining marks, case-folds, normalizes final sigma, collapses punctuation/whitespace, and retains both Greek and Latin tokens. Scoring weights are exact: preferred name 100, ancient/alternate name 70, locality/region/country 35, classification 20, description 10; prefix matches receive 1.25 times the field weight.

- [ ] **Step 2: Write failing facet, year-overlap, and statistics tests**

```js
test('filters compose and chronology uses overlap semantics', () => {
  const result = filterEntities(fixtures, {
    facets: { entityClass: ['sanctuary'], country: ['GRC'] },
    years: { min: -500, max: -300 },
  });
  assert.deepEqual(result.map(({ id }) => id), ['delphi']);
});

test('contextual facet counts ignore only their own active facet', () => {
  const options = getFacetOptions(fixtures, activeFilters, 'country', 'el');
  assert.deepEqual(options.find(({ value }) => value === 'GRC').count, 2);
});

test('statistics are derived from the filtered set', () => {
  const stats = buildStatistics(fixtures.filter(x => x.entityClass === 'polity'), 'en');
  assert.deepEqual(stats.entityClass.map(x => [x.value, x.count]), [['polity', 2]]);
});
```

- [ ] **Step 3: Confirm all three domain modules are missing**

Run: `node --test tests/web/search.test.js tests/web/filters.test.js tests/web/statistics.test.js`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 4: Implement the pure discovery pipeline**

Filter categories are `entityClass`, `collection`, `country`, `ancientRegion`, `confidence`, and `geometryRole`. Values within a facet use OR; different facets use AND. Chronology includes an entity when its primary range intersects the chosen range. Search scores restrict and order the matching entities; with no query, locale-aware name ordering uses `Intl.Collator(localeFor(lang), { sensitivity: 'base' })`.

Statistics return accessible arrays `{ value, label, count, percentage }`. Chronology buckets classify by earliest attested/start year with exact boundaries: Bronze Age through 1100 BCE, Archaic 1099–480 BCE, Classical 479–323 BCE, Hellenistic 322–31 BCE, Roman 30 BCE–330 CE, Late Antiquity 331–700 CE.

- [ ] **Step 5: Run domain tests and commit**

Run: `node --test tests/web/search.test.js tests/web/filters.test.js tests/web/statistics.test.js`  
Expected: PASS.

```powershell
git add src/web/search.js src/web/filters.js src/web/statistics.js tests/web/search.test.js tests/web/filters.test.js tests/web/statistics.test.js
git commit -m "feat: add atlas discovery engine"
```

---

### Task 4: Central state and shareable URL state

**Files:**
- Create: `src/web/state.js`
- Create: `src/web/url-state.js`
- Create: `tests/web/state.test.js`
- Create: `tests/web/url-state.test.js`

**Interfaces:**
- Consumes: model extents from Task 2 and query/filter semantics from Task 3.
- Produces: `createInitialState(model, urlState?): AppState`, `reducer(state, action): AppState`, `createStore(initialState, reducerFn?): Store`, `deriveResults(model, state, searchIndex): DerivedResults`, `parseUrlState(search): Partial<AppState>`, `serializeUrlState(state): string`, `historyIntent(action): 'push'|'replace'|'none'`.
- `Store` exposes `getState()`, `dispatch(action)`, and `subscribe(listener)` returning an unsubscribe function.

- [ ] **Step 1: Write failing reducer and selector tests**

```js
test('filter actions are immutable and reset preserves language and map', () => {
  const next = reducer(initial, { type: 'filter/toggle', facet: 'country', value: 'GRC' });
  assert.notEqual(next, initial);
  assert.deepEqual(next.filters.facets.country, ['GRC']);
  const reset = reducer(next, { type: 'filters/reset' });
  assert.equal(reset.lang, initial.lang);
  assert.deepEqual(reset.map, initial.map);
});

test('deriveResults composes search and facets once', () => {
  const result = deriveResults(model, searchedAndFilteredState, searchIndex);
  assert.deepEqual(result.entities.map(x => x.id), ['city-athens-attica']);
  assert.equal(result.activeFilterCount, 2);
});
```

- [ ] **Step 2: Write failing URL round-trip and stale-parameter tests**

```js
test('meaningful atlas state round-trips through query parameters', () => {
  const query = serializeUrlState(state);
  assert.deepEqual(parseUrlState(query), expectedPublicState);
});

test('invalid language, zoom, coordinates, tabs, and years are ignored independently', () => {
  assert.deepEqual(parseUrlState('?lang=xx&z=99&lat=x&tab=wrong&from=0'), {});
});
```

Use parameters `lang`, `tab`, `q`, `class`, `collection`, `country`, `region`, `confidence`, `geometry`, `from`, `to`, `entity`, `lat`, `lng`, `z`, and `base`. Arrays serialize as sorted comma-separated URI-safe values. Year zero is rejected.

- [ ] **Step 3: Run tests and verify missing state modules**

Run: `node --test tests/web/state.test.js tests/web/url-state.test.js`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 4: Implement reducer, store, selectors, and URL contract**

Default state is Greek, Catalogue tab, empty query/facets, full model year extent, no selected entity, neutral basemap, atlas extent centre, zoom 4, and closed mobile sheet. Reducer actions cover language, tab, query, facet toggle/clear, year range, reset, entity select/clear, map viewport/basemap, sheet open/close, and load/error status. Unknown actions return the identical state object.

`historyIntent` returns `push` for entity selection/clear and user tab changes, `replace` for map viewport, language, query, filter, year, and basemap changes, and `none` for loading/error actions.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/web/state.test.js tests/web/url-state.test.js`  
Expected: PASS.

```powershell
git add src/web/state.js src/web/url-state.js tests/web/state.test.js tests/web/url-state.test.js
git commit -m "feat: synchronize atlas state and URLs"
```

---

### Task 5: Catalogue, facets, search, and statistics renderers

**Files:**
- Create: `src/web/catalogue.js`
- Create: `src/web/render.js`
- Create: `tests/web/dom-fixture.js`
- Create: `tests/web/catalogue.test.js`
- Create: `tests/web/render.test.js`
- Modify: `assets/styles/components.css`
- Modify: `assets/styles/layout.css`

**Interfaces:**
- Consumes: `DerivedResults`, `FacetOption[]`, `StatisticsModel`, state, and i18n helpers.
- Produces: `buildCatalogueRows(entities, lang, query): CatalogueRow[]`, `renderCatalogue(root, model, handlers): void`, `renderWorkbench(elements, viewModel, handlers): void`, `createElement(tag, attrs?, children?): HTMLElement`, `replaceChildren(root, children): void`.
- Renderer handlers are `{ dispatch, onPreview, onLeavePreview, onOpenDetails }`.

- [ ] **Step 1: Write failing view-model and safety tests**

```js
test('catalogue rows expose localized place, date, class, and uncertainty', () => {
  const [row] = buildCatalogueRows([entity], 'el', '');
  assert.equal(row.title, 'Αίγινα');
  assert.equal(row.location, 'Αίγινα · Ελλάδα');
  assert.equal(row.geometryRole, 'site');
  assert.match(row.date, /π\.Χ\./);
});

test('shared element helper writes dataset text through textContent', () => {
  const element = createElement('span', {}, ['<img src=x onerror=alert(1)>']);
  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(element.querySelector('img'), null);
});
```

Run DOM-facing tests in a minimal test document installed by `tests/web/dom-fixture.js`; it implements the small `createElement`, `createTextNode`, `append`, `replaceChildren`, `querySelector`, `dataset`, and event-listener surface used by renderers, avoiding a production DOM dependency.

- [ ] **Step 2: Run renderer tests and confirm missing modules**

Run: `node --test tests/web/catalogue.test.js tests/web/render.test.js`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement safe catalogue and panel rendering**

Catalogue buttons carry entity IDs in `dataset.entityId`, use a real heading per record, expose a localized full-label `aria-label`, and support pointer enter/leave plus focus/blur previews. Render at most the 226 in-memory records; no pagination or virtualization is introduced.

The filter panel renders one active facet at a time, its search field, contextual counts, disabled zero-count values, active chips, chronology range inputs, and pinned reset/show footer. Search renders a labelled input with clear action and result count. Statistics render native buttons with a text label, exact count, percentage, and CSS width variable; clicking a bar dispatches the matching filter action.

- [ ] **Step 4: Finish the workbench component styling**

Use square 1px rules, restrained hover fills, tab underlines, compact 44px rows, typographic hierarchy, sticky headers/footers, and a quiet selected-record treatment. Active chips must wrap without horizontal overflow. The Statistics bars retain readable text at 200% zoom and do not depend on colour alone.

- [ ] **Step 5: Run renderer tests, validate HTML, and commit**

Run: `npm run test:web`  
Run: `npm run validate:html`  
Expected: all web unit tests and HTML validation pass.

```powershell
git add src/web/catalogue.js src/web/render.js tests/web assets/styles
git commit -m "feat: render atlas discovery workbench"
```

---

### Task 6: Clustered point map, legend, and previews

**Files:**
- Create: `src/web/map.js`
- Create: `tests/web/map.test.js`
- Modify: `assets/styles/components.css`
- Modify: `assets/styles/responsive.css`

**Interfaces:**
- Consumes: adapted entities, active language, and handlers `{ onSelect, onPreview, onViewportChange, onBasemapChange }`.
- Produces: `markerDescriptor(entity, lang): MarkerDescriptor`, `clusterDescriptor(count): ClusterDescriptor`, `createAtlasMap(options): AtlasMapController`.
- `AtlasMapController` exposes `setEntities(entities, lang)`, `setSelected(id)`, `focusEntity(id, options?)`, `fitAll()`, `setBasemap(id)`, `invalidateSize()`, and `destroy()`.

- [ ] **Step 1: Write failing marker and cluster semantic tests**

```js
test('individual marker descriptors classify without ordinal text', () => {
  const marker = markerDescriptor(settlement, 'el');
  assert.equal(marker.shape, 'circle');
  assert.equal(marker.text, '');
  assert.match(marker.ariaLabel, /Οικισμός/);
});

test('cluster descriptors contain only their member count', () => {
  assert.deepEqual(clusterDescriptor(17), { count: 17, size: 'medium', ariaLabel: '17 records' });
});

test('representative centres retain an explicit uncertainty modifier', () => {
  assert.equal(markerDescriptor(polity, 'en').spatialRole, 'representative_center');
});
```

- [ ] **Step 2: Run map tests and confirm the controller is absent**

Run: `node --test tests/web/map.test.js`  
Expected: FAIL with module-not-found for `map.js`.

- [ ] **Step 3: Implement the Leaflet controller behind a narrow boundary**

Initialize a neutral Carto Positron layer and OpenStreetMap layer, move zoom controls away from the bottom mobile action bar, and construct `L.markerClusterGroup` with count-only `iconCreateFunction`, spiderfy, and zoom-to-bounds enabled. Use `L.divIcon` class shapes for settlement/circle, sanctuary/diamond, polity/square, plus `is-proxy` and `is-representative` modifiers.

`setEntities` diffs by entity ID, clears stale markers, preserves selected state, and closes a preview whose record was filtered out. Marker click selects; pointer/focus previews do not mutate selection. Viewport callbacks are debounced and do not fire during programmatic URL restoration.

- [ ] **Step 4: Render map-owned legend, status, and bounded previews**

The legend shows all three class symbols and live visible counts, then separately explains clusters, proxies, and representative centres. The status strip renders visible/total records and pointer latitude/longitude to four decimals on fine-pointer devices. Preview DOM is built with text nodes, clamps to the viewport, and contains name, ancient name, class/collection, place, chronology, uncertainty, and Details button.

- [ ] **Step 5: Run map tests and commit**

Run: `node --test tests/web/map.test.js`  
Run: `npm run validate:html`  
Expected: PASS.

```powershell
git add src/web/map.js tests/web/map.test.js assets/styles
git commit -m "feat: add clustered semantic atlas map"
```

---

### Task 7: Scholarly record details and relation navigation

**Files:**
- Create: `src/web/details.js`
- Create: `tests/web/details.test.js`
- Modify: `assets/styles/components.css`
- Modify: `assets/styles/responsive.css`

**Interfaces:**
- Consumes: selected adapted entity, `entitiesById`, `authoritiesById`, active language, and handlers `{ onClose, onNavigateEntity, onCopyCoordinates }`.
- Produces: `buildDetailsModel(entity, atlas, lang): DetailsModel`, `groupSources(sources): SourceGroup[]`, `renderDetails(dialog, detailsModel, handlers): void`, `openDetails(dialog, trigger): void`, `closeDetails(dialog): void`.

- [ ] **Step 1: Write failing detail-model tests**

```js
test('details keep chronology qualifiers, spatial role, and source scopes', () => {
  const details = buildDetailsModel(entity, atlas, 'en');
  assert.match(details.chronologies[0].label, /BCE/);
  assert.equal(details.place.geometryRole, 'representative centre');
  assert.ok(details.sourceGroups.some(group => group.scope === 'geometry'));
});

test('internal relationships navigate by entity id and authorities stay text', () => {
  const details = buildDetailsModel(entityWithRelations, atlas, 'el');
  assert.equal(details.relationships[0].targetEntityId, 'colony-miletus');
  assert.equal(details.relationships[1].targetEntityId, null);
});

test('duplicate source support is grouped without losing claim scopes', () => {
  const groups = groupSources(repeatedSources);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].scopes.sort(), ['geometry', 'identity']);
});
```

- [ ] **Step 2: Run detail tests and confirm the module is absent**

Run: `node --test tests/web/details.test.js`  
Expected: FAIL with module-not-found for `details.js`.

- [ ] **Step 3: Implement the complete bilingual record model and renderer**

Render preferred/ancient names, class/subtype/collections, description, all chronology assertions and notes, locality/country/region, coordinates and role, typed relationships, sources grouped by claim scope, external identifiers, confidence, review state, and last review date. Pleiades URIs are external links with `target="_blank"` and `rel="noopener noreferrer"`; internal entity relations are buttons that dispatch selection without reloading.

Coordinate copy uses `navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)` with a selected-range fallback when clipboard access is unavailable. Copy success/failure is announced through `app-status`.

- [ ] **Step 4: Implement dialog focus, history, and mobile sheet behaviour**

Use native `<dialog>`, focus the close button on open, close on Escape or backdrop click, retain the invoking element, and restore focus only when it remains connected. On mobile the dialog occupies the viewport with a sticky title/close row and independent content scrolling. It contains no media placeholder.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/web/details.test.js`  
Run: `npm run validate:html`  
Expected: PASS.

```powershell
git add src/web/details.js tests/web/details.test.js assets/styles
git commit -m "feat: add source-rich entity details"
```

---

### Task 8: Application integration, mobile workbench, and resilient startup

**Files:**
- Create: `src/web/app.js`
- Create: `tests/web/app.test.js`
- Modify: `src/web/render.js`
- Modify: `index.html`
- Modify: `assets/styles/base.css`
- Modify: `assets/styles/layout.css`
- Modify: `assets/styles/responsive.css`

**Interfaces:**
- Consumes: every module/controller from Tasks 2–7 and the DOM IDs from Task 1.
- Produces: browser startup with `bootstrap({ document, window, fetchImpl, leaflet }): Promise<AppController>`; `AppController` exposes `store`, `atlas`, `map`, `render()`, and `destroy()` for smoke tests.

- [ ] **Step 1: Write failing integration tests with injected browser effects**

```js
test('bootstrap keeps the catalogue usable when map creation fails', async () => {
  const app = await bootstrap({ document, window, fetchImpl: okFetch, leaflet: null });
  assert.equal(app.atlas.entities.length, 226);
  assert.match(document.querySelector('#map-error').textContent, /χάρτης/i);
  assert.equal(document.querySelectorAll('[data-entity-id]').length, 226);
});

test('data failure renders an actionable bilingual error without a blank shell', async () => {
  await assert.rejects(() => bootstrap({ document, window, fetchImpl: failingFetch }), /data request/i);
  assert.equal(document.querySelector('#workbench').hidden, false);
  assert.match(document.querySelector('#app-error').textContent, /δεδομένα/i);
});
```

- [ ] **Step 2: Run the integration test and confirm startup is absent**

Run: `node --test tests/web/app.test.js`  
Expected: FAIL with module-not-found for `app.js`.

- [ ] **Step 3: Wire startup, rendering, effects, URL history, and language**

Bootstrap loads and adapts data, parses URL state, creates search index/store/map, subscribes one scheduled renderer, binds all controls once, and removes the loading state. Each render computes one `DerivedResults` object and passes the same entity array to catalogue, statistics, legend, and map. Popstate replaces store state without writing a new history entry.

Set `<html lang>`, title, meta description, all `data-i18n` text, input placeholders, ARIA labels, count grammar, and active tab labels on language change. First visit is Greek; an explicit URL language wins over local preference.

- [ ] **Step 4: Complete desktop keyboard and mobile sheet interactions**

ArrowLeft/ArrowRight move through the tab list; Home/End jump to first/last tab. Mobile action buttons open the corresponding tab and sheet, close returns focus, Escape closes, selection may collapse the sheet, and resize calls `map.invalidateSize()`. Body scroll locks only for full record/About dialogs, not while the workbench sheet is open.

Render loading skeleton, zero-results reset, map-specific error, and fatal-data error distinctly. A tile failure shows a non-blocking bilingual notice and leaves markers/catalogue functional.

- [ ] **Step 5: Run the complete unit/data/HTML suite and commit**

Run: `npm test`  
Expected: all web tests, 51 existing Python tests, and HTML validation pass.

```powershell
git add src/web/app.js src/web/render.js tests/web/app.test.js index.html assets/styles
git commit -m "feat: integrate responsive bilingual webgis"
```

---

### Task 9: Browser verification and accessibility hardening

**Files:**
- Create: `tests/e2e/atlas.spec.mjs`
- Create: `playwright.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: frontend files identified by failing checks

**Interfaces:**
- Consumes: the running static site at `http://127.0.0.1:4173`.
- Produces: `npm run test:e2e` desktop/mobile regression command and screenshot evidence under ignored `test-results/`.

- [ ] **Step 1: Write browser checks before visual fixes**

Install `@playwright/test` at exact version `1.62.1`, add `"test:e2e": "playwright test"`, and configure a `webServer` that runs `npm run serve`, reuses an existing server outside CI, and targets `http://127.0.0.1:4173`. Configure Chromium projects for `Desktop Chrome` at 1440×900 and `Mobile Chrome` at 390×844. The browser suite must assert:

```js
import { expect, test } from '@playwright/test';

await page.goto('/?lang=el');
await expect(page.locator('#result-list [data-entity-id]')).toHaveCount(226);
await expect(page.locator('html')).toHaveAttribute('lang', 'el');
await page.getByRole('button', { name: /Φίλτρα/ }).click();
await page.getByRole('checkbox', { name: /Ελλάδα/ }).check();
await expect(page.locator('#result-count')).not.toContainText('226');
await page.reload();
await expect(page.getByRole('checkbox', { name: /Ελλάδα/ })).toBeChecked();
```

Add checks for English switching, Greek accent-insensitive search, class/country/year filter composition, count-only clusters, relation navigation, Back/Forward restoration, map-failure catalogue fallback, tab keyboard control, dialog focus return, zero console errors, no horizontal overflow at 390×844, bottom-sheet internal scrolling, and 200% zoom at 1280×720.

- [ ] **Step 2: Run tests against the first integrated build**

Run: `npm install`  
Run: `npx playwright install chromium`  
Run: `npm run test:e2e`  
Expected: initial failures identify real layout, interaction, or accessibility gaps; retain their output as the fix checklist.

- [ ] **Step 3: Fix every reproducible browser failure at its source**

Do not weaken selectors or remove assertions to make failures disappear. Correct focus order, overflow, hit targets, stale URL state, map resizing, selected-row visibility, preview clamping, status announcements, and Greek text wrapping in the owning module or stylesheet.

- [ ] **Step 4: Perform visual review at four canonical viewports**

Capture and inspect full-page plus detail-view screenshots at 1440×900, 1024×768, 768×1024, and 390×844. Verify masthead proportion, 400px desktop workbench, list density, legend placement, cluster/marker distinction, Greek title rendering, sheet height, safe-area spacing, and source readability. Record no screenshot baselines in Git; only code fixes are committed.

- [ ] **Step 5: Re-run and commit the hardened UI**

Run: `npm test`  
Run: `npm run test:e2e`  
Expected: every automated and browser check passes with zero page-console errors.

```powershell
git add package.json package-lock.json playwright.config.mjs tests/e2e src/web assets/styles index.html
git commit -m "test: harden webgis across desktop and mobile"
```

---

### Task 10: Documentation, GitHub Pages workflow, and release verification

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `CITATION.cff`
- Create: `docs/WEBGIS.md`
- Create: `scripts/prepare-pages.mjs`
- Create: `tests/web/pages-contract.test.js`

**Interfaces:**
- Consumes: the completed repository-root static site and full verification commands.
- Produces: `preparePages(root, destination): Promise<string[]>`, `collectLocalReferences(htmlPath): Promise<string[]>`, and a GitHub Pages `_site` artifact containing `index.html`, `assets`, `src/web`, `dist/ancient-greek-world.json`, licences, and attribution documents.

- [ ] **Step 1: Write a failing Pages artifact contract**

```js
test('all local page references resolve inside the prepared artifact', async () => {
  await preparePages(repoRoot, output);
  const references = await collectLocalReferences('index.html');
  for (const reference of references) {
    assert.equal(reference.startsWith('/'), false, reference);
    await access(resolve(repoRoot, reference));
  }
});

test('deployment contains no secrets or backend configuration', async () => {
  const source = await readFrontendText();
  assert.doesNotMatch(source, /supabase|service_role|anon[_-]key/i);
});
```

- [ ] **Step 2: Run the Pages contract and confirm workflow/docs are absent**

Run: `node --test tests/web/pages-contract.test.js`  
Expected: FAIL until reference collection and deployment files are present.

- [ ] **Step 3: Add a least-privilege GitHub Pages workflow**

`scripts/prepare-pages.mjs` recreates `_site` from an explicit allow-list: `index.html`, `assets`, `src/web`, `dist/ancient-greek-world.json`, `LICENSE-CODE`, `LICENSE-DATA`, `CITATION.cff`, and `README.md`. Add `"prepare:pages": "node scripts/prepare-pages.mjs"` to `package.json`. The workflow triggers on pushes to `main` and manual dispatch, grants `contents: read`, `pages: write`, and `id-token: write`, runs `npm ci`, `npm test`, and `npm run prepare:pages`, uploads `_site`, then deploys through the official GitHub Pages action. Concurrency group is `pages` with in-progress deployments cancelled.

- [ ] **Step 4: Update public project documentation**

README opens with the live WebGIS purpose, Greek/English summary, launch/development commands, 226-record data statement, symbol/cluster explanation, spatial uncertainty caveat, source/licence attribution, and GitHub Pages deployment instructions. `docs/WEBGIS.md` documents URL parameters, keyboard controls, filter semantics, chronology overlap, basemaps, and failure fallback. CHANGELOG adds the WebGIS release and CITATION identifies the software plus dataset version.

- [ ] **Step 5: Run every release gate and commit**

Run: `python scripts/validate_release.py --canonical data/canonical --report-dir reports`  
Run: `python scripts/export_release.py --canonical data/canonical --dist dist --check`  
Run: `npm test`  
Run: `npm run test:e2e`  
Run: `git diff --check`  
Expected: zero data errors, deterministic exports, all unit/browser/HTML/Pages checks pass, and no whitespace errors.

```powershell
git add .github .gitignore package.json package-lock.json README.md CHANGELOG.md CITATION.cff docs/WEBGIS.md scripts/prepare-pages.mjs tests/web/pages-contract.test.js
git commit -m "release: prepare static atlas for GitHub Pages"
```

---

## Final acceptance checklist

- [ ] Greek loads first and every public state can switch to English without reload.
- [ ] Exactly 226 records load from the reviewed static release.
- [ ] Catalogue, filters, search, statistics, map, and details share one derived result set.
- [ ] Individual markers are unnumbered and class-shaped; cluster text is the contained count.
- [ ] Map legend lives on the map and explains uncertainty.
- [ ] Region and polity polygons are absent.
- [ ] Mobile retains a usable scrollable catalogue while the map remains visible.
- [ ] Details expose chronology, geometry role, relations, sources, and Pleiades links without empty media UI.
- [ ] URL sharing and browser history restore language, discovery state, selection, and viewport.
- [ ] Catalogue/details remain usable if Leaflet or map tiles fail.
- [ ] Unit, data, HTML, browser, accessibility, Pages-path, and deterministic-export gates pass.
- [ ] The repository is ready to push to a new GitHub remote and enable GitHub Pages.
