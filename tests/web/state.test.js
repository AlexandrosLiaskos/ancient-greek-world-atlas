import assert from 'node:assert/strict';
import test from 'node:test';

import { createSearchIndex } from '../../src/web/search.js';
import {
  createInitialState,
  createStore,
  deriveResults,
  reducer,
} from '../../src/web/state.js';
import { discoveryEntities } from './domain-fixtures.js';

function makeModel() {
  const entities = discoveryEntities();
  return {
    entities,
    entitiesById: new Map(entities.map((entity) => [entity.id, entity])),
    extent: [[37.385, 22.501], [40.75, 27.256]],
    yearExtent: [-2000, 700],
  };
}

test('initial state is Greek, catalogue-first, full-range, and centred on the model extent', () => {
  const state = createInitialState(makeModel());

  assert.equal(state.lang, 'el');
  assert.equal(state.activeTab, 'catalogue');
  assert.deepEqual(state.filters.years, { min: -2000, max: 700 });
  assert.deepEqual(state.map, {
    latitude: 39.0675,
    longitude: 24.8785,
    zoom: 4,
    basemap: 'positron',
  });
  assert.equal(state.selectedEntityId, null);
  assert.equal(state.mobileSheetOpen, false);
});

test('filter actions are immutable and reset preserves language, tab, and map', () => {
  const initial = {
    ...createInitialState(makeModel()),
    lang: 'en',
    activeTab: 'filters',
    map: { latitude: 38, longitude: 23, zoom: 7, basemap: 'osm' },
  };
  const toggled = reducer(initial, { type: 'filter/toggle', facet: 'country', value: 'GRC' });

  assert.notEqual(toggled, initial);
  assert.notEqual(toggled.filters, initial.filters);
  assert.deepEqual(toggled.filters.facets.country, ['GRC']);
  assert.deepEqual(initial.filters.facets.country, []);

  const reset = reducer(toggled, { type: 'filters/reset' });
  assert.equal(reset.lang, 'en');
  assert.equal(reset.activeTab, 'filters');
  assert.deepEqual(reset.map, initial.map);
  assert.deepEqual(reset.filters.facets.country, []);
  assert.deepEqual(reset.filters.years, { min: -2000, max: 700 });
});

test('the store notifies only when the reducer produces a new state', () => {
  const store = createStore(createInitialState(makeModel()));
  const observed = [];
  const unsubscribe = store.subscribe((state, action) => observed.push([state.lang, action.type]));

  store.dispatch({ type: 'unknown' });
  store.dispatch({ type: 'language/set', lang: 'en' });
  store.dispatch({ type: 'language/set', lang: 'en' });
  unsubscribe();
  store.dispatch({ type: 'language/set', lang: 'el' });

  assert.deepEqual(observed, [['en', 'language/set']]);
});

test('deriveResults composes query and filters into one shared result set', () => {
  const model = makeModel();
  const index = createSearchIndex(model.entities);
  let state = createInitialState(model);
  state = reducer(state, { type: 'query/set', query: 'Athens' });
  state = reducer(state, { type: 'filter/toggle', facet: 'entityClass', value: 'settlement' });
  state = reducer(state, { type: 'entity/select', entityId: 'athens' });
  const derived = deriveResults(model, state, index);

  assert.deepEqual(derived.entities.map(({ id }) => id), ['athens']);
  assert.equal(derived.total, 1);
  assert.equal(derived.activeFilterCount, 1);
  assert.equal(derived.selectedEntity.id, 'athens');
  assert.equal(derived.statistics.total, 1);
  assert.equal(derived.facetOptions.every(({ count }) => count >= 0), true);
});

test('invalid reducer payloads do not create impossible state', () => {
  const initial = createInitialState(makeModel());

  assert.equal(reducer(initial, { type: 'tab/set', tab: 'wrong' }), initial);
  assert.equal(reducer(initial, { type: 'language/set', lang: 'fr' }), initial);
  assert.equal(reducer(initial, { type: 'years/set', min: 100, max: -100 }), initial);
  assert.equal(reducer(initial, { type: 'filter/toggle', facet: 'wrong', value: 'x' }), initial);
});
