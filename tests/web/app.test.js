import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { appendElement, installDOM } from './dom-fixture.js';

const release = JSON.parse(await readFile(new URL('../../dist/ancient-greek-world.json', import.meta.url), 'utf8'));

function appendWithText(document, tag, id, text = '', parent = document.body) {
  const element = appendElement(document, tag, id, parent);
  element.textContent = text;
  return element;
}

function createShell() {
  const document = installDOM();
  const meta = appendElement(document, 'meta', 'meta-description', document.head);
  meta.content = '';
  const app = appendElement(document, 'div', 'app');
  app.dataset.source = './dist/ancient-greek-world.json';
  app.dataset.status = 'loading';
  const mastheadTitle = appendElement(document, 'h1', 'masthead-title', app);
  const languageToggle = appendElement(document, 'button', 'language-toggle', app);
  const aboutButton = appendElement(document, 'button', 'about-button', app);
  const workbench = appendElement(document, 'aside', 'workbench', app);
  workbench.hidden = false;

  for (const name of ['catalogue', 'filters', 'search', 'statistics']) {
    const tab = appendElement(document, 'button', `tab-${name}`, workbench);
    tab.dataset.tab = name;
    tab.append(document.createElement('span'));
    appendElement(document, 'section', `panel-${name}`, workbench);
  }
  appendElement(document, 'span', 'result-count', workbench);
  appendElement(document, 'ul', 'result-list', workbench);
  appendElement(document, 'div', 'empty-state', workbench);
  appendElement(document, 'button', 'empty-reset', workbench);
  appendElement(document, 'div', 'active-filter-summary', workbench);
  appendElement(document, 'div', 'active-filter-chips', workbench);
  appendElement(document, 'b', 'filter-badge', workbench);
  appendElement(document, 'div', 'facet-picker', workbench);
  appendElement(document, 'button', 'reset-filters', workbench);
  appendElement(document, 'button', 'show-results', workbench);
  appendElement(document, 'input', 'search-input', workbench);
  appendElement(document, 'button', 'clear-search', workbench);
  appendElement(document, 'p', 'search-summary', workbench);
  appendElement(document, 'ul', 'search-results', workbench);
  appendElement(document, 'span', 'statistics-count', workbench);
  appendElement(document, 'div', 'statistics-content', workbench);

  appendElement(document, 'div', 'map', app);
  appendElement(document, 'div', 'map-loading', app);
  appendElement(document, 'div', 'map-error', app);
  appendElement(document, 'button', 'legend-toggle', app);
  appendElement(document, 'div', 'legend-content', app);
  appendElement(document, 'b', 'legend-settlement-count', app);
  appendElement(document, 'b', 'legend-sanctuary-count', app);
  appendElement(document, 'b', 'legend-polity-count', app);
  appendElement(document, 'span', 'coordinate-status', app);
  appendElement(document, 'span', 'visible-status', app);
  appendElement(document, 'button', 'sheet-close', app);

  const mobileActions = appendElement(document, 'nav', 'mobile-actions', app);
  for (const name of ['catalogue', 'filters', 'search', 'statistics']) {
    const action = document.createElement('button');
    action.dataset.mobileTab = name;
    action.append(document.createElement('span'));
    mobileActions.append(action);
  }

  const recordDialog = appendElement(document, 'dialog', 'record-dialog', app);
  appendElement(document, 'h2', 'record-title', recordDialog);
  appendElement(document, 'button', 'record-close', recordDialog);
  appendElement(document, 'div', 'record-content', recordDialog);
  const aboutDialog = appendElement(document, 'dialog', 'about-dialog', app);
  appendElement(document, 'h2', 'about-title', aboutDialog);
  appendElement(document, 'button', 'about-close', aboutDialog);
  appendElement(document, 'div', 'about-content', aboutDialog);
  appendElement(document, 'div', 'app-status', app);
  const appError = appendElement(document, 'section', 'app-error', app);
  appError.hidden = true;
  appendWithText(document, 'h2', 'app-error-title', '', appError);
  appendWithText(document, 'p', 'app-error-body', '', appError);
  appendElement(document, 'button', 'retry-load', appError);

  const listeners = new Map();
  const historyCalls = [];
  const window = {
    document,
    innerWidth: 1440,
    location: { pathname: '/atlas/', search: '?lang=el', hash: '' },
    history: {
      pushState(_state, _title, url) { historyCalls.push(['push', url]); },
      replaceState(_state, _title, url) { historyCalls.push(['replace', url]); },
    },
    navigator: {},
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
    },
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
  };
  document.defaultView = window;
  return { document, window, historyCalls, mastheadTitle, languageToggle, aboutButton };
}

const okFetch = async () => ({ ok: true, status: 200, json: async () => structuredClone(release) });
const failingFetch = async () => ({ ok: false, status: 503, json: async () => ({}) });

test('bootstrap keeps the full catalogue usable when map creation fails', async () => {
  const { bootstrap } = await import('../../src/web/app.js');
  const { document, window } = createShell();
  const app = await bootstrap({ document, window, fetchImpl: okFetch, leaflet: null });

  assert.equal(app.atlas.entities.length, 226);
  assert.match(document.querySelector('#map-error').textContent, /χάρτης/i);
  assert.equal(document.querySelectorAll('[data-entity-id]').length, 226);
  assert.equal(document.querySelector('#result-count').textContent, '226 εγγραφές');
  assert.equal(document.querySelector('#app').dataset.status, 'ready');
  app.destroy();
});

test('data failure renders an actionable Greek error without a blank shell', async () => {
  const { bootstrap } = await import('../../src/web/app.js');
  const { document, window } = createShell();

  await assert.rejects(
    () => bootstrap({ document, window, fetchImpl: failingFetch, leaflet: null }),
    /data request/i,
  );
  assert.equal(document.querySelector('#workbench').hidden, false);
  assert.equal(document.querySelector('#app-error').hidden, false);
  assert.match(document.querySelector('#app-error').textContent, /δεδομένα/i);
});

test('language and selection update the shell, URL, and scholarly dialog without reload', async () => {
  const { bootstrap } = await import('../../src/web/app.js');
  const { document, window, historyCalls } = createShell();
  const app = await bootstrap({ document, window, fetchImpl: okFetch, leaflet: null });
  const first = app.atlas.entities[0];

  app.store.dispatch({ type: 'language/set', lang: 'en' });
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title, 'Ancient Greek World Atlas');
  assert.equal(document.querySelector('#language-toggle').textContent, 'ΕΛ');

  app.store.dispatch({ type: 'entity/select', entityId: first.id });
  assert.equal(document.querySelector('#record-dialog').open, true);
  assert.equal(document.querySelector('#record-title').textContent, first.name.en);
  assert.match(document.querySelector('#record-content').textContent, /Sources/);
  assert.ok(historyCalls.some(([intent, url]) => intent === 'push' && url.includes(`entity=${first.id}`)));
  app.destroy();
});

test('the zero-result recovery action clears both search and facets', async () => {
  const { bootstrap } = await import('../../src/web/app.js');
  const { document, window } = createShell();
  const app = await bootstrap({ document, window, fetchImpl: okFetch, leaflet: null });
  app.store.dispatch({ type: 'query/set', query: 'definitely-no-such-ancient-place' });
  app.store.dispatch({ type: 'filter/toggle', facet: 'country', value: 'GRC' });
  assert.equal(app.store.getState().query.length > 0, true);

  document.querySelector('#empty-reset').dispatchEvent({ type: 'click' });
  assert.equal(app.store.getState().query, '');
  assert.deepEqual(app.store.getState().filters.facets.country, []);
  assert.equal(document.querySelectorAll('[data-entity-id]').length, 226);
  app.destroy();
});
