import {
  countActiveFilters,
  createEmptyFacets,
  FACETS,
  filterEntities,
  getFacetOptions,
} from './filters.js';
import { normalizeSearchText, search } from './search.js';
import { buildStatistics } from './statistics.js';

export const TABS = Object.freeze(['catalogue', 'filters', 'search', 'statistics']);
export const BASEMAPS = Object.freeze(['positron', 'osm']);

function extentCentre(extent) {
  const [[south, west], [north, east]] = extent;
  return {
    latitude: Number(((Number(south) + Number(north)) / 2).toFixed(6)),
    longitude: Number(((Number(west) + Number(east)) / 2).toFixed(6)),
  };
}

function cloneFacets(partial = {}) {
  const facets = createEmptyFacets();
  for (const facet of FACETS) {
    if (Array.isArray(partial[facet])) {
      facets[facet] = [...new Set(partial[facet].map(String).filter(Boolean))];
    }
  }
  return facets;
}

function sanitizeYears(years, yearExtent) {
  const [extentMin, extentMax] = yearExtent;
  const suppliedMin = Number(years?.min);
  const suppliedMax = Number(years?.max);
  const min = Number.isFinite(suppliedMin) && suppliedMin !== 0
    ? Math.max(extentMin, Math.trunc(suppliedMin))
    : extentMin;
  const max = Number.isFinite(suppliedMax) && suppliedMax !== 0
    ? Math.min(extentMax, Math.trunc(suppliedMax))
    : extentMax;
  return min <= max ? { min, max } : { min: extentMin, max: extentMax };
}

export function createInitialState(model, urlState = {}) {
  const centre = extentCentre(model.extent);
  const yearExtent = [...model.yearExtent];
  const facets = cloneFacets(urlState.filters?.facets);
  const selectedId = typeof urlState.selectedEntityId === 'string'
    && (!model.entitiesById?.size || model.entitiesById.has(urlState.selectedEntityId))
    ? urlState.selectedEntityId
    : null;
  const urlMap = urlState.map ?? {};
  const latitude = Number(urlMap.latitude);
  const longitude = Number(urlMap.longitude);
  const zoom = Number(urlMap.zoom);

  return Object.freeze({
    lang: urlState.lang === 'en' ? 'en' : 'el',
    activeTab: TABS.includes(urlState.activeTab) ? urlState.activeTab : 'catalogue',
    activeFacet: FACETS.includes(urlState.activeFacet) ? urlState.activeFacet : 'entityClass',
    facetQuery: '',
    query: typeof urlState.query === 'string' ? urlState.query : '',
    filters: Object.freeze({
      facets: Object.freeze(facets),
      years: Object.freeze(sanitizeYears(urlState.filters?.years, yearExtent)),
      yearExtent: Object.freeze(yearExtent),
    }),
    selectedEntityId: selectedId,
    map: Object.freeze({
      latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : centre.latitude,
      longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : centre.longitude,
      zoom: Number.isInteger(zoom) && zoom >= 2 && zoom <= 18 ? zoom : 4,
      basemap: BASEMAPS.includes(urlMap.basemap) ? urlMap.basemap : 'positron',
    }),
    mobileSheetOpen: false,
    status: 'ready',
    error: null,
  });
}

function replaceFilter(state, filters) {
  return Object.freeze({ ...state, filters: Object.freeze(filters) });
}

export function reducer(state, action) {
  switch (action?.type) {
    case 'language/set': {
      if (!['el', 'en'].includes(action.lang) || action.lang === state.lang) return state;
      return Object.freeze({ ...state, lang: action.lang });
    }
    case 'tab/set': {
      if (!TABS.includes(action.tab) || action.tab === state.activeTab) return state;
      return Object.freeze({ ...state, activeTab: action.tab });
    }
    case 'facet/set-active': {
      if (!FACETS.includes(action.facet) || action.facet === state.activeFacet) return state;
      return Object.freeze({ ...state, activeFacet: action.facet, facetQuery: '' });
    }
    case 'facet-query/set': {
      const facetQuery = String(action.query ?? '');
      if (facetQuery === state.facetQuery) return state;
      return Object.freeze({ ...state, facetQuery });
    }
    case 'query/set': {
      const query = String(action.query ?? '');
      if (query === state.query) return state;
      return Object.freeze({ ...state, query });
    }
    case 'filter/toggle': {
      if (!FACETS.includes(action.facet) || !String(action.value ?? '').trim()) return state;
      const current = state.filters.facets[action.facet] ?? [];
      const value = String(action.value);
      const selected = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      const facets = Object.freeze({ ...state.filters.facets, [action.facet]: Object.freeze(selected) });
      return replaceFilter(state, { ...state.filters, facets });
    }
    case 'filter/clear': {
      if (!FACETS.includes(action.facet) || !state.filters.facets[action.facet]?.length) return state;
      const facets = Object.freeze({ ...state.filters.facets, [action.facet]: Object.freeze([]) });
      return replaceFilter(state, { ...state.filters, facets });
    }
    case 'filters/reset': {
      const facets = Object.freeze(cloneFacets());
      const [min, max] = state.filters.yearExtent;
      return replaceFilter(state, {
        facets,
        years: Object.freeze({ min, max }),
        yearExtent: state.filters.yearExtent,
      });
    }
    case 'years/set': {
      const min = Number(action.min);
      const max = Number(action.max);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min === 0 || max === 0 || min > max) return state;
      const [extentMin, extentMax] = state.filters.yearExtent;
      const years = Object.freeze({ min: Math.max(extentMin, min), max: Math.min(extentMax, max) });
      if (years.min > years.max) return state;
      if (years.min === state.filters.years.min && years.max === state.filters.years.max) return state;
      return replaceFilter(state, { ...state.filters, years });
    }
    case 'entity/select': {
      const entityId = String(action.entityId ?? '').trim() || null;
      if (entityId === state.selectedEntityId) return state;
      return Object.freeze({ ...state, selectedEntityId: entityId });
    }
    case 'entity/clear': {
      if (state.selectedEntityId === null) return state;
      return Object.freeze({ ...state, selectedEntityId: null });
    }
    case 'map/viewport': {
      const latitude = Number(action.latitude);
      const longitude = Number(action.longitude);
      const zoom = Number(action.zoom);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
        || !Number.isInteger(zoom) || zoom < 2 || zoom > 18) return state;
      if (latitude === state.map.latitude && longitude === state.map.longitude && zoom === state.map.zoom) return state;
      return Object.freeze({
        ...state,
        map: Object.freeze({ ...state.map, latitude, longitude, zoom }),
      });
    }
    case 'map/basemap': {
      if (!BASEMAPS.includes(action.basemap) || action.basemap === state.map.basemap) return state;
      return Object.freeze({ ...state, map: Object.freeze({ ...state.map, basemap: action.basemap }) });
    }
    case 'sheet/open': {
      if (state.mobileSheetOpen) return state;
      return Object.freeze({ ...state, mobileSheetOpen: true });
    }
    case 'sheet/close': {
      if (!state.mobileSheetOpen) return state;
      return Object.freeze({ ...state, mobileSheetOpen: false });
    }
    case 'app/status': {
      const status = String(action.status ?? 'ready');
      const error = action.error ?? null;
      if (status === state.status && error === state.error) return state;
      return Object.freeze({ ...state, status, error });
    }
    case 'state/replace':
      return action.state && typeof action.state === 'object' ? Object.freeze(action.state) : state;
    default:
      return state;
  }
}

export function createStore(initialState, reducerFn = reducer) {
  let state = initialState;
  const listeners = new Set();
  return Object.freeze({
    getState: () => state,
    dispatch(action) {
      const next = reducerFn(state, action);
      if (next === state) return state;
      state = next;
      for (const listener of [...listeners]) listener(state, action);
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Store listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function deriveResults(model, state, searchIndex) {
  const hasQuery = Boolean(normalizeSearchText(state.query));
  const scores = hasQuery ? search(searchIndex, state.query) : null;
  const entities = filterEntities(model.entities, state.filters, scores, state.lang);
  const facetUniverse = scores instanceof Map
    ? model.entities.filter(({ id }) => scores.has(id))
    : model.entities;
  return Object.freeze({
    entities: Object.freeze(entities),
    total: entities.length,
    scores,
    activeFilterCount: countActiveFilters(state.filters),
    facetOptions: Object.freeze(getFacetOptions(facetUniverse, state.filters, state.activeFacet, state.lang)),
    statistics: buildStatistics(entities, state.lang),
    selectedEntity: state.selectedEntityId ? model.entitiesById.get(state.selectedEntityId) ?? null : null,
  });
}
