import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialState, reducer } from '../../src/web/state.js';
import {
  historyIntent,
  parseUrlState,
  serializeUrlState,
} from '../../src/web/url-state.js';

const model = {
  entities: [],
  entitiesById: new Map(),
  extent: [[30, -10], [45, 40]],
  yearExtent: [-2000, 700],
};

test('meaningful state round-trips through shareable URL parameters', () => {
  let state = createInitialState(model);
  state = reducer(state, { type: 'language/set', lang: 'en' });
  state = reducer(state, { type: 'tab/set', tab: 'filters' });
  state = reducer(state, { type: 'query/set', query: 'Apollo oracle' });
  state = reducer(state, { type: 'filter/toggle', facet: 'entityClass', value: 'sanctuary' });
  state = reducer(state, { type: 'filter/toggle', facet: 'country', value: 'TUR' });
  state = reducer(state, { type: 'filter/toggle', facet: 'country', value: 'GRC' });
  state = reducer(state, { type: 'years/set', min: -500, max: 300 });
  state = reducer(state, { type: 'entity/select', entityId: 'delphi' });
  state = reducer(state, { type: 'map/viewport', latitude: 38.4824, longitude: 22.501, zoom: 7 });
  state = reducer(state, { type: 'map/basemap', basemap: 'osm' });

  const query = serializeUrlState(state);
  const parameters = new URLSearchParams(query);
  assert.equal(parameters.get('lang'), 'en');
  assert.equal(parameters.get('class'), 'sanctuary');
  assert.equal(parameters.get('country'), 'GRC,TUR');
  assert.equal(parameters.get('entity'), 'delphi');

  assert.deepEqual(parseUrlState(query), {
    lang: 'en',
    activeTab: 'filters',
    query: 'Apollo oracle',
    filters: {
      facets: { entityClass: ['sanctuary'], country: ['GRC', 'TUR'] },
      years: { min: -500, max: 300 },
    },
    selectedEntityId: 'delphi',
    map: { latitude: 38.4824, longitude: 22.501, zoom: 7, basemap: 'osm' },
  });
});

test('invalid parameters are ignored independently instead of blocking startup', () => {
  assert.deepEqual(parseUrlState('?lang=xx&z=99&lat=x&tab=wrong&from=0'), {});
  assert.deepEqual(parseUrlState('?lang=en&from=-500&to=bad&base=positron'), {
    lang: 'en',
    filters: { years: { min: -500 } },
    map: { basemap: 'positron' },
  });
});

test('URL parsing rejects unsafe identifiers but preserves Unicode search text', () => {
  assert.deepEqual(parseUrlState('?entity=%3Cscript%3E&q=%CE%94%CE%B5%CE%BB%CF%86%CE%BF%CE%AF'), {
    query: 'Δελφοί',
  });
});

test('history intent distinguishes navigation, continuous state, and internal status', () => {
  assert.equal(historyIntent({ type: 'entity/select' }), 'push');
  assert.equal(historyIntent({ type: 'entity/clear' }), 'push');
  assert.equal(historyIntent({ type: 'tab/set' }), 'push');
  assert.equal(historyIntent({ type: 'map/viewport' }), 'replace');
  assert.equal(historyIntent({ type: 'filter/toggle' }), 'replace');
  assert.equal(historyIntent({ type: 'app/status' }), 'none');
});

