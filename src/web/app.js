import { loadAtlas } from './data.js';
import {
  buildDetailsModel,
  closeDetails,
  copyCoordinates,
  openDetails,
  renderDetails,
} from './details.js';
import { message } from './i18n.js';
import { createAtlasMap } from './map.js';
import { renderWorkbench } from './render.js';
import { createSearchIndex } from './search.js';
import {
  createInitialState,
  createStore,
  deriveResults,
} from './state.js';
import {
  historyIntent,
  parseUrlState,
  serializeUrlState,
} from './url-state.js';

const TAB_NAMES = Object.freeze(['catalogue', 'filters', 'search', 'statistics']);

function byId(document, id) {
  return document.getElementById?.(id) ?? document.querySelector?.(`#${id}`) ?? null;
}

function collectElements(document) {
  const panels = Object.fromEntries(TAB_NAMES.map((name) => [name, byId(document, `panel-${name}`)]));
  return {
    app: byId(document, 'app'),
    mastheadTitle: byId(document, 'masthead-title'),
    metaDescription: byId(document, 'meta-description'),
    languageToggle: byId(document, 'language-toggle'),
    aboutButton: byId(document, 'about-button'),
    workbench: byId(document, 'workbench'),
    toolTabs: byId(document, 'tool-tabs'),
    tabs: [...(document.querySelectorAll?.('[data-tab]') ?? [])],
    panels,
    resultCount: byId(document, 'result-count'),
    resultList: byId(document, 'result-list'),
    emptyState: byId(document, 'empty-state'),
    emptyReset: byId(document, 'empty-reset'),
    filterBadge: byId(document, 'filter-badge'),
    activeFilterSummary: byId(document, 'active-filter-summary'),
    activeFilterChips: byId(document, 'active-filter-chips'),
    facetPicker: byId(document, 'facet-picker'),
    resetFilters: byId(document, 'reset-filters'),
    showResults: byId(document, 'show-results'),
    searchInput: byId(document, 'search-input'),
    clearSearch: byId(document, 'clear-search'),
    searchSummary: byId(document, 'search-summary'),
    searchResults: byId(document, 'search-results'),
    statisticsCount: byId(document, 'statistics-count'),
    statisticsContent: byId(document, 'statistics-content'),
    mapElement: byId(document, 'map'),
    mapLoading: byId(document, 'map-loading'),
    mapError: byId(document, 'map-error'),
    legendToggle: byId(document, 'legend-toggle'),
    legendContent: byId(document, 'legend-content'),
    legendSettlementCount: byId(document, 'legend-settlement-count'),
    legendSanctuaryCount: byId(document, 'legend-sanctuary-count'),
    legendPolityCount: byId(document, 'legend-polity-count'),
    coordinateStatus: byId(document, 'coordinate-status'),
    visibleStatus: byId(document, 'visible-status'),
    mobileActions: [...(document.querySelectorAll?.('[data-mobile-tab]') ?? [])],
    sheetClose: byId(document, 'sheet-close'),
    recordDialog: byId(document, 'record-dialog'),
    recordClose: byId(document, 'record-close'),
    aboutDialog: byId(document, 'about-dialog'),
    aboutClose: byId(document, 'about-close'),
    appStatus: byId(document, 'app-status'),
    appError: byId(document, 'app-error'),
    appErrorTitle: byId(document, 'app-error-title'),
    appErrorBody: byId(document, 'app-error-body'),
    retryLoad: byId(document, 'retry-load'),
  };
}

function setText(document, id, value) {
  const element = byId(document, id);
  if (element) element.textContent = value;
}

function setAria(element, name, value) {
  element?.setAttribute?.(`aria-${name}`, value);
}

function translateShell(document, elements, lang, { selected = false } = {}) {
  document.documentElement.lang = lang;
  document.title = message(lang, 'appTitle');
  if (elements.metaDescription) elements.metaDescription.content = message(lang, 'metaDescription');
  if (elements.mastheadTitle) elements.mastheadTitle.textContent = message(lang, 'appTitle');
  if (elements.languageToggle) {
    elements.languageToggle.textContent = lang === 'el' ? 'EN' : 'ΕΛ';
    setAria(elements.languageToggle, 'label', message(lang, 'switchLanguage'));
  }
  setAria(elements.aboutButton, 'label', message(lang, 'about'));
  setAria(elements.workbench, 'label', message(lang, 'workbench'));
  setAria(elements.toolTabs, 'label', message(lang, 'tabsLabel'));

  for (const tab of elements.tabs) {
    const label = tab.querySelector?.('span');
    if (label) label.textContent = message(lang, tab.dataset.tab);
  }
  for (const action of elements.mobileActions) {
    const label = action.querySelector?.('span');
    if (label) label.textContent = message(lang, action.dataset.mobileTab);
  }

  setText(document, 'catalogue-heading', message(lang, 'catalogue'));
  setText(document, 'filters-heading', message(lang, 'filters'));
  setText(document, 'search-heading', message(lang, 'search'));
  setText(document, 'statistics-heading', message(lang, 'statistics'));
  setText(document, 'reset-filters', message(lang, 'clear'));
  setText(document, 'empty-title', message(lang, 'noResultsTitle'));
  setText(document, 'empty-body', message(lang, 'noResultsBody'));
  setText(document, 'empty-reset', message(lang, 'clearFilters'));
  setText(document, 'search-label', message(lang, 'searchLabel'));
  setText(document, 'statistics-intro', message(lang, 'statisticsHint'));
  if (elements.searchInput) elements.searchInput.placeholder = message(lang, 'searchPlaceholder');
  setAria(elements.clearSearch, 'label', message(lang, 'clearSearch'));
  setAria(elements.sheetClose, 'label', message(lang, 'closePanel'));

  setAria(elements.mapElement, 'label', message(lang, 'mapLabel'));
  setAria(elements.mapElement?.parentNode, 'label', message(lang, 'mapRegionLabel'));
  setText(document, 'map-loading-label', message(lang, 'mapLoading'));
  setText(document, 'legend-label', message(lang, 'legend'));
  setText(document, 'legend-settlement-label', message(lang, 'settlements'));
  setText(document, 'legend-sanctuary-label', message(lang, 'sanctuaries'));
  setText(document, 'legend-polity-label', message(lang, 'polities'));
  setText(document, 'legend-cluster-label', message(lang, 'cluster'));
  setText(document, 'legend-uncertain-label', message(lang, 'uncertainPoint'));

  setText(document, 'about-title', message(lang, 'about'));
  setAria(elements.aboutClose, 'label', message(lang, 'closeAbout'));
  setText(document, 'about-intro', lang === 'el'
    ? 'Ο Άτλας του Αρχαίου Ελληνικού Κόσμου παρουσιάζει 226 τεκμηριωμένους οικισμούς, ιερά και πολιτείες σε ένα δίγλωσσο γεωγραφικό ευρετήριο.'
    : 'The Ancient Greek World Atlas presents 226 documented settlements, sanctuaries, and polities in a bilingual geographic index.');
  setText(document, 'about-spatial', lang === 'el'
    ? 'Τα σημεία δηλώνουν αρχαιολογικές θέσεις, τεκμηριωμένες προσεγγίσεις ή αντιπροσωπευτικά κέντρα· δεν αποτελούν πολιτικά όρια.'
    : 'Points represent archaeological sites, documented approximations, or representative centres; they are not political boundaries.');
  if (!selected) setText(document, 'record-title', message(lang, 'record'));
  setAria(elements.recordClose, 'label', message(lang, 'closeRecord'));
}

function renderFatal(document, elements, lang) {
  translateShell(document, elements, lang);
  if (elements.app) elements.app.dataset.status = 'error';
  if (elements.appError) elements.appError.hidden = false;
  if (elements.appErrorTitle) elements.appErrorTitle.textContent = message(lang, 'dataLoadErrorTitle');
  if (elements.appErrorBody) elements.appErrorBody.textContent = message(lang, 'dataLoadErrorBody');
  if (elements.retryLoad) elements.retryLoad.textContent = message(lang, 'retry');
  if (elements.resultList) {
    elements.resultList.setAttribute?.('aria-busy', 'false');
    elements.resultList.replaceChildren?.();
  }
}

function historyUrl(window, state) {
  return `${window.location.pathname}${serializeUrlState(state)}${window.location.hash ?? ''}`;
}

export async function bootstrap(options = {}) {
  const document = options.document ?? globalThis.document;
  const window = options.window ?? globalThis.window;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const leaflet = Object.hasOwn(options, 'leaflet') ? options.leaflet : globalThis.L;
  if (!document || !window) throw new TypeError('A document and window are required.');
  const elements = collectElements(document);
  if (!elements.app || !elements.workbench || !elements.resultList || !elements.mapElement) {
    throw new TypeError('The atlas shell is incomplete.');
  }

  const initialUrl = parseUrlState(window.location?.search ?? '');
  const initialLanguage = initialUrl.lang === 'en' ? 'en' : 'el';
  translateShell(document, elements, initialLanguage);
  elements.app.dataset.status = 'loading';
  if (elements.appError) elements.appError.hidden = true;

  let atlas;
  try {
    atlas = await loadAtlas(fetchImpl, elements.app.dataset.source || './dist/ancient-greek-world.json');
  } catch (error) {
    renderFatal(document, elements, initialLanguage);
    throw error;
  }

  const searchIndex = createSearchIndex(atlas.entities);
  const store = createStore(createInitialState(atlas, initialUrl));
  const cleanups = [];
  let mapController = null;
  let mapUnavailable = false;
  let destroyed = false;
  let lastDetailsTrigger = null;
  let renderedDetailKey = '';
  let lastMobileTrigger = null;

  const announce = (text) => {
    if (!elements.appStatus) return;
    elements.appStatus.textContent = '';
    window.requestAnimationFrame?.(() => { elements.appStatus.textContent = text; });
  };

  const dispatch = (action) => store.dispatch(action);
  const legendElements = {
    settlement: elements.legendSettlementCount,
    sanctuary: elements.legendSanctuaryCount,
    polity: elements.legendPolityCount,
    coordinateStatus: elements.coordinateStatus,
    visibleStatus: elements.visibleStatus,
  };

  try {
    const state = store.getState();
    mapController = createAtlasMap({
      element: elements.mapElement,
      entities: atlas.entities,
      lang: state.lang,
      viewport: state.map,
      basemap: state.map.basemap,
      totalCount: atlas.entities.length,
      legendElements,
      leaflet,
      onSelect(entityId) {
        lastDetailsTrigger = elements.mapElement;
        dispatch({ type: 'entity/select', entityId });
      },
      onPreview() {},
      onLeavePreview() {},
      onViewportChange(viewport) {
        dispatch({ type: 'map/viewport', ...viewport });
      },
      onBasemapChange(basemap) {
        dispatch({ type: 'map/basemap', basemap });
      },
      onTileError() {
        if (!elements.mapError) return;
        elements.mapError.textContent = message(store.getState().lang, 'mapTileError');
        elements.mapError.hidden = false;
      },
    });
    if (elements.mapLoading) elements.mapLoading.hidden = true;
  } catch {
    mapUnavailable = true;
    if (elements.mapLoading) elements.mapLoading.hidden = true;
    if (elements.mapError) {
      elements.mapError.textContent = message(store.getState().lang, 'mapError');
      elements.mapError.hidden = false;
    }
  }

  function detailsHandlers() {
    return {
      onNavigateEntity(entityId) {
        lastDetailsTrigger = elements.recordDialog;
        dispatch({ type: 'entity/select', entityId });
        mapController?.focusEntity(entityId, { openPreview: false });
      },
      onCopyCoordinates(place) {
        copyCoordinates(place.latitude, place.longitude, {
          navigatorObject: window.navigator,
          documentObject: document,
          lang: store.getState().lang,
          onStatus: announce,
        });
      },
    };
  }

  function render(action = { type: 'app/render' }) {
    if (destroyed) return;
    const state = store.getState();
    const derived = deriveResults(atlas, state, searchIndex);
    translateShell(document, elements, state.lang, { selected: Boolean(derived.selectedEntity) });
    renderWorkbench(elements, { model: atlas, state, derived }, {
      dispatch,
      onPreview() {},
      onLeavePreview() { mapController?.closePreview(); },
      onOpenDetails(entityId, trigger) {
        lastDetailsTrigger = trigger ?? document.activeElement ?? elements.resultList;
        dispatch({ type: 'entity/select', entityId });
        if (window.innerWidth < 760) dispatch({ type: 'sheet/close' });
        mapController?.setSelected(entityId);
      },
    });

    mapController?.setEntities(derived.entities, state.lang);
    mapController?.setSelected(state.selectedEntityId);
    mapController?.setBasemap(state.map.basemap);
    if (action.type === 'state/replace') mapController?.restoreViewport(state.map);
    if (mapUnavailable && elements.mapError) {
      elements.mapError.textContent = message(state.lang, 'mapError');
      elements.mapError.hidden = false;
    }

    if (derived.selectedEntity && elements.recordDialog) {
      const detailKey = `${derived.selectedEntity.id}|${state.lang}`;
      if (detailKey !== renderedDetailKey) {
        renderDetails(
          elements.recordDialog,
          buildDetailsModel(derived.selectedEntity, atlas, state.lang),
          detailsHandlers(),
        );
        renderedDetailKey = detailKey;
      }
      if (!elements.recordDialog.open) openDetails(elements.recordDialog, lastDetailsTrigger);
    } else if (elements.recordDialog?.open) {
      closeDetails(elements.recordDialog);
      renderedDetailKey = '';
    }

    for (const actionButton of elements.mobileActions) {
      const active = actionButton.dataset.mobileTab === state.activeTab;
      actionButton.classList.toggle('is-active', active);
      setAria(actionButton, 'pressed', active ? 'true' : 'false');
    }
    elements.app.dataset.status = 'ready';
    elements.app.dataset.sheetOpen = String(state.mobileSheetOpen);
    return derived;
  }

  const unsubscribe = store.subscribe((state, action) => {
    render(action);
    const intent = historyIntent(action);
    if (intent === 'push') window.history.pushState(null, '', historyUrl(window, state));
    if (intent === 'replace') window.history.replaceState(null, '', historyUrl(window, state));
  });
  cleanups.push(unsubscribe);

  function listen(target, type, listener, optionsValue) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, optionsValue);
    cleanups.push(() => target.removeEventListener?.(type, listener, optionsValue));
  }

  for (const tab of elements.tabs) {
    listen(tab, 'click', () => dispatch({ type: 'tab/set', tab: tab.dataset.tab }));
    listen(tab, 'keydown', (event) => {
      const current = TAB_NAMES.indexOf(tab.dataset.tab);
      let next = null;
      if (event.key === 'ArrowRight') next = (current + 1) % TAB_NAMES.length;
      if (event.key === 'ArrowLeft') next = (current - 1 + TAB_NAMES.length) % TAB_NAMES.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = TAB_NAMES.length - 1;
      if (next === null) return;
      event.preventDefault?.();
      dispatch({ type: 'tab/set', tab: TAB_NAMES[next] });
      elements.tabs[next]?.focus?.();
    });
  }

  listen(elements.languageToggle, 'click', () => dispatch({
    type: 'language/set',
    lang: store.getState().lang === 'el' ? 'en' : 'el',
  }));
  listen(elements.searchInput, 'input', (event) => dispatch({ type: 'query/set', query: event.target.value }));
  listen(elements.clearSearch, 'click', () => {
    dispatch({ type: 'query/set', query: '' });
    elements.searchInput?.focus?.();
  });
  listen(elements.resetFilters, 'click', () => dispatch({ type: 'filters/reset' }));
  listen(elements.emptyReset, 'click', () => {
    dispatch({ type: 'query/set', query: '' });
    dispatch({ type: 'filters/reset' });
  });
  listen(elements.showResults, 'click', () => {
    dispatch({ type: 'tab/set', tab: 'catalogue' });
    dispatch({ type: 'sheet/close' });
  });
  for (const action of elements.mobileActions) {
    listen(action, 'click', () => {
      lastMobileTrigger = action;
      dispatch({ type: 'tab/set', tab: action.dataset.mobileTab });
      dispatch({ type: 'sheet/open' });
      window.requestAnimationFrame?.(() => elements.tabs.find((tab) => tab.dataset.tab === action.dataset.mobileTab)?.focus?.());
      mapController?.invalidateSize();
    });
  }
  listen(elements.sheetClose, 'click', () => {
    dispatch({ type: 'sheet/close' });
    lastMobileTrigger?.focus?.();
  });

  listen(elements.legendToggle, 'click', () => {
    const expanded = elements.legendToggle.getAttribute('aria-expanded') !== 'false';
    elements.legendToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (elements.legendContent) elements.legendContent.hidden = expanded;
  });
  listen(elements.aboutButton, 'click', () => {
    if (!elements.aboutDialog.open) elements.aboutDialog.showModal();
    elements.aboutClose?.focus?.();
  });
  listen(elements.aboutClose, 'click', () => elements.aboutDialog?.close?.());
  listen(elements.aboutDialog, 'click', (event) => {
    if (event.target === elements.aboutDialog) elements.aboutDialog.close();
  });
  listen(elements.recordClose, 'click', () => dispatch({ type: 'entity/clear' }));
  listen(elements.recordDialog, 'cancel', (event) => {
    event.preventDefault?.();
    dispatch({ type: 'entity/clear' });
  });
  listen(elements.recordDialog, 'click', (event) => {
    if (event.target === elements.recordDialog) dispatch({ type: 'entity/clear' });
  });
  listen(elements.recordDialog, 'close', () => {
    if (store.getState().selectedEntityId) dispatch({ type: 'entity/clear' });
  });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && store.getState().mobileSheetOpen && !elements.recordDialog?.open && !elements.aboutDialog?.open) {
      dispatch({ type: 'sheet/close' });
      lastMobileTrigger?.focus?.();
    }
  });

  const onPopState = () => {
    const next = createInitialState(atlas, parseUrlState(window.location.search));
    store.dispatch({ type: 'state/replace', state: next });
  };
  listen(window, 'popstate', onPopState);
  let resizeTimer = null;
  listen(window, 'resize', () => {
    window.clearTimeout?.(resizeTimer);
    resizeTimer = window.setTimeout?.(() => mapController?.invalidateSize(), 80);
  });
  cleanups.push(() => window.clearTimeout?.(resizeTimer));
  listen(elements.retryLoad, 'click', () => window.location.reload?.());

  render();
  return Object.freeze({
    store,
    atlas,
    map: mapController,
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      mapController?.destroy();
    },
  });
}

if (typeof globalThis.window !== 'undefined'
  && typeof globalThis.document !== 'undefined'
  && globalThis.document.querySelector?.('#app')) {
  bootstrap().catch(() => {});
}
