import { BASEMAPS, TABS } from './state.js';

const FACET_PARAMETERS = Object.freeze({
  class: 'entityClass',
  collection: 'collection',
  country: 'country',
  region: 'ancientRegion',
  confidence: 'confidence',
  geometry: 'geometryRole',
});

const SAFE_TOKEN = /^[\p{L}\p{N}._-]+$/u;
const SAFE_ENTITY_ID = /^[a-z0-9][a-z0-9-]*$/;

function parseArray(value) {
  if (!value) return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter((item) => SAFE_TOKEN.test(item)))].sort();
}

function parseYear(value) {
  if (!/^-?\d+$/.test(value ?? '')) return null;
  const year = Number(value);
  return Number.isSafeInteger(year) && year !== 0 ? year : null;
}

function parseCoordinate(value, minimum, maximum) {
  if (value === null || value === '' || !Number.isFinite(Number(value))) return null;
  const coordinate = Number(value);
  return coordinate >= minimum && coordinate <= maximum ? coordinate : null;
}

function parseZoom(value) {
  if (!/^\d+$/.test(value ?? '')) return null;
  const zoom = Number(value);
  return Number.isInteger(zoom) && zoom >= 2 && zoom <= 18 ? zoom : null;
}

export function parseUrlState(search = '') {
  const parameters = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ''));
  const state = {};
  const lang = parameters.get('lang');
  if (lang === 'el' || lang === 'en') state.lang = lang;
  const tab = parameters.get('tab');
  if (TABS.includes(tab)) state.activeTab = tab;
  const query = parameters.get('q');
  if (query?.trim()) state.query = query.trim();

  const facets = {};
  for (const [parameter, facet] of Object.entries(FACET_PARAMETERS)) {
    const values = parseArray(parameters.get(parameter));
    if (values.length) facets[facet] = values;
  }
  const years = {};
  const minimum = parseYear(parameters.get('from'));
  const maximum = parseYear(parameters.get('to'));
  if (minimum !== null) years.min = minimum;
  if (maximum !== null) years.max = maximum;
  if (Object.keys(facets).length || Object.keys(years).length) {
    state.filters = {};
    if (Object.keys(facets).length) state.filters.facets = facets;
    if (Object.keys(years).length) state.filters.years = years;
  }

  const selectedEntityId = parameters.get('entity');
  if (SAFE_ENTITY_ID.test(selectedEntityId ?? '')) state.selectedEntityId = selectedEntityId;

  const map = {};
  const latitude = parseCoordinate(parameters.get('lat'), -90, 90);
  const longitude = parseCoordinate(parameters.get('lng'), -180, 180);
  if (latitude !== null && longitude !== null) {
    map.latitude = latitude;
    map.longitude = longitude;
  }
  const zoom = parseZoom(parameters.get('z'));
  if (zoom !== null) map.zoom = zoom;
  const basemap = parameters.get('base');
  if (BASEMAPS.includes(basemap)) map.basemap = basemap;
  if (Object.keys(map).length) state.map = map;

  return state;
}

function compactNumber(value, digits = 5) {
  return String(Number(Number(value).toFixed(digits)));
}

export function serializeUrlState(state) {
  const parameters = new URLSearchParams();
  parameters.set('lang', state.lang === 'en' ? 'en' : 'el');
  if (state.activeTab && state.activeTab !== 'catalogue') parameters.set('tab', state.activeTab);
  if (state.query?.trim()) parameters.set('q', state.query.trim());

  for (const [parameter, facet] of Object.entries(FACET_PARAMETERS)) {
    const values = state.filters?.facets?.[facet] ?? [];
    if (values.length) parameters.set(parameter, [...new Set(values)].sort().join(','));
  }
  const [extentMin, extentMax] = state.filters?.yearExtent ?? [];
  const minimum = state.filters?.years?.min;
  const maximum = state.filters?.years?.max;
  if (Number.isInteger(minimum) && minimum !== extentMin) parameters.set('from', String(minimum));
  if (Number.isInteger(maximum) && maximum !== extentMax) parameters.set('to', String(maximum));

  if (SAFE_ENTITY_ID.test(state.selectedEntityId ?? '')) parameters.set('entity', state.selectedEntityId);
  const { latitude, longitude, zoom, basemap } = state.map ?? {};
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    parameters.set('lat', compactNumber(latitude));
    parameters.set('lng', compactNumber(longitude));
  }
  if (Number.isInteger(zoom)) parameters.set('z', String(zoom));
  if (BASEMAPS.includes(basemap)) parameters.set('base', basemap);

  const serialized = parameters.toString();
  return serialized ? `?${serialized}` : '';
}

export function historyIntent(action) {
  if (['entity/select', 'entity/clear', 'tab/set'].includes(action?.type)) return 'push';
  if ([
    'language/set',
    'query/set',
    'filter/toggle',
    'filter/clear',
    'filters/reset',
    'years/set',
    'map/viewport',
    'map/basemap',
  ].includes(action?.type)) return 'replace';
  return 'none';
}

export { FACET_PARAMETERS };
