import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptRelease } from '../../src/web/data.js';
import { createSearchIndex } from '../../src/web/search.js';
import { createInitialState, deriveResults, reducer } from '../../src/web/state.js';
import { makeRelease } from './fixtures.js';
import { installDOM } from './dom-fixture.js';

function fixtureView() {
  const model = adaptRelease(makeRelease());
  const state = createInitialState(model);
  return {
    model,
    state,
    derived: deriveResults(model, state, createSearchIndex(model.entities)),
  };
}

test('shared element helper writes dataset strings through textContent', async () => {
  installDOM();
  const { createElement } = await import('../../src/web/render.js');
  const element = createElement('span', {}, ['<img src=x onerror=alert(1)>']);

  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(element.querySelector('img'), null);
});

test('filter renderer exposes facets, contextual counts, chronology, and dispatches changes', async () => {
  const document = installDOM();
  const { renderFilters } = await import('../../src/web/render.js');
  const view = fixtureView();
  const root = document.createElement('div');
  const actions = [];

  renderFilters(root, view, { dispatch: (action) => actions.push(action) });

  assert.equal(root.querySelectorAll('[data-facet]').length, 6);
  const option = root.querySelector('[data-filter-value]');
  assert.equal(option.tagName, 'INPUT');
  assert.equal(option.dataset.filterValue, 'settlement');
  assert.match(root.textContent, /Οικισμός/);
  assert.match(root.textContent, /Χρονολογία/);

  option.checked = true;
  option.dispatchEvent({ type: 'change' });
  assert.deepEqual(actions.at(-1), {
    type: 'filter/toggle',
    facet: 'entityClass',
    value: 'settlement',
  });
});

test('statistics renderer uses native buttons, exact counts, and visible percentages', async () => {
  const document = installDOM();
  const { renderStatistics } = await import('../../src/web/render.js');
  const view = fixtureView();
  const root = document.createElement('div');
  const actions = [];

  renderStatistics(root, view, { dispatch: (action) => actions.push(action) });

  const bar = root.querySelector('[data-stat-value]');
  assert.equal(bar.tagName, 'BUTTON');
  assert.equal(bar.dataset.statValue, 'settlement');
  assert.equal(bar.style.getPropertyValue('--bar-size'), '100%');
  assert.match(bar.textContent, /1/);
  assert.match(bar.getAttribute('aria-label'), /100/);

  bar.dispatchEvent({ type: 'click' });
  assert.deepEqual(actions.at(-1), {
    type: 'filter/toggle',
    facet: 'entityClass',
    value: 'settlement',
  });
});

test('workbench renderer keeps one active tab and one shared result set', async () => {
  const document = installDOM();
  const { renderWorkbench } = await import('../../src/web/render.js');
  const view = fixtureView();
  const elements = {
    app: document.createElement('div'),
    tabs: ['catalogue', 'filters', 'search', 'statistics'].map((tab) => {
      const button = document.createElement('button');
      button.dataset.tab = tab;
      return button;
    }),
    panels: Object.fromEntries(['catalogue', 'filters', 'search', 'statistics'].map((tab) => [tab, document.createElement('section')])),
    resultCount: document.createElement('span'),
    resultList: document.createElement('ul'),
    emptyState: document.createElement('div'),
    filterBadge: document.createElement('b'),
    facetPicker: document.createElement('div'),
    searchInput: document.createElement('input'),
    clearSearch: document.createElement('button'),
    searchSummary: document.createElement('p'),
    searchResults: document.createElement('div'),
    statisticsCount: document.createElement('span'),
    statisticsContent: document.createElement('div'),
    activeFilterSummary: document.createElement('div'),
    activeFilterChips: document.createElement('div'),
    resetFilters: document.createElement('button'),
    showResults: document.createElement('button'),
  };

  renderWorkbench(elements, view, { dispatch() {} });

  assert.equal(elements.tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(elements.tabs[1].getAttribute('aria-selected'), 'false');
  assert.equal(elements.panels.catalogue.hidden, false);
  assert.equal(elements.panels.filters.hidden, true);
  assert.equal(elements.resultList.querySelectorAll('[data-entity-id]').length, 1);
  assert.equal(elements.resultCount.textContent, '1 εγγραφή');
  assert.equal(elements.statisticsCount.textContent, '1 εγγραφή');
});

test('active filter chips stay interactive in both catalogue and filter summaries', async () => {
  const document = installDOM();
  const { renderWorkbench } = await import('../../src/web/render.js');
  const view = fixtureView();
  view.state = reducer(view.state, { type: 'filter/toggle', facet: 'country', value: 'GRC' });
  view.derived = deriveResults(view.model, view.state, createSearchIndex(view.model.entities));
  const actions = [];
  const elements = {
    tabs: [],
    panels: {},
    activeFilterSummary: document.createElement('div'),
    activeFilterChips: document.createElement('div'),
  };

  renderWorkbench(elements, view, { dispatch: (action) => actions.push(action) });
  const summaryChip = elements.activeFilterSummary.querySelector('[data-chip-value]');
  const filterChip = elements.activeFilterChips.querySelector('[data-chip-value]');
  assert.ok(summaryChip);
  assert.ok(filterChip);

  summaryChip.dispatchEvent({ type: 'click' });
  filterChip.dispatchEvent({ type: 'click' });
  assert.deepEqual(actions, [
    { type: 'filter/toggle', facet: 'country', value: 'GRC' },
    { type: 'filter/toggle', facet: 'country', value: 'GRC' },
  ]);
});
