import { renderCatalogue } from './catalogue.js';
import { FACETS } from './filters.js';
import {
  formatYear,
  message,
  vocabularyLabel,
} from './i18n.js';
import { normalizeSearchText } from './search.js';

const STATISTICS_GROUPS = Object.freeze([
  ['entityClass', 'entityClass'],
  ['collection', 'collection'],
  ['country', 'country'],
  ['period', 'chronology'],
  ['geometryRole', 'geometryRole'],
  ['confidence', 'confidence'],
]);

const PERIOD_RANGES = Object.freeze({
  bronze: [-2000, -1100],
  archaic: [-1099, -480],
  classical: [-479, -323],
  hellenistic: [-322, -31],
  roman: [-30, 330],
  lateAntique: [331, 700],
});

function appendChildren(element, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child?.nodeType ? child : document.createTextNode(String(child)));
  }
}

export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'className') element.className = String(value);
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key === 'style') {
      for (const [name, styleValue] of Object.entries(value)) element.style.setProperty(name, styleValue);
    } else if (key === 'on') {
      for (const [type, listener] of Object.entries(value)) element.addEventListener(type, listener);
    } else if (key.startsWith('aria-') || key === 'role') element.setAttribute(key, String(value));
    else if (key in element) element[key] = value;
    else element.setAttribute(key, String(value));
  }
  appendChildren(element, children);
  return element;
}

export function replaceChildren(root, children = []) {
  root.replaceChildren(...[children].flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
}

function dispatch(handlers, action) {
  handlers.dispatch?.(action);
}

function facetNavigation(state, lang, handlers) {
  return createElement('div', {
    className: 'facet-navigation',
    role: 'tablist',
    'aria-label': message(lang, 'filterField'),
  }, FACETS.map((facet) => createElement('button', {
    className: `facet-tab${state.activeFacet === facet ? ' is-active' : ''}`,
    type: 'button',
    role: 'tab',
    dataset: { facet },
    'aria-selected': state.activeFacet === facet ? 'true' : 'false',
    on: { click: () => dispatch(handlers, { type: 'facet/set-active', facet }) },
  }, vocabularyLabel('facet', facet, lang))));
}

function facetOptions(view, handlers) {
  const { state, derived } = view;
  const query = normalizeSearchText(state.facetQuery);
  const options = derived.facetOptions.filter(({ label }) => (
    !query || normalizeSearchText(label).includes(query)
  ));

  const optionRows = options.map((option) => {
    const inputId = `facet-${state.activeFacet}-${option.value}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const input = createElement('input', {
      id: inputId,
      type: 'checkbox',
      checked: option.selected,
      disabled: option.disabled,
      dataset: {
        filterFacet: state.activeFacet,
        filterValue: option.value,
      },
      on: {
        change: () => dispatch(handlers, {
          type: 'filter/toggle',
          facet: state.activeFacet,
          value: option.value,
        }),
      },
    });
    return createElement('label', {
      className: `facet-option${option.selected ? ' is-selected' : ''}`,
      for: inputId,
    }, [
      input,
      createElement('span', { className: 'facet-option-label' }, option.label),
      createElement('span', { className: 'facet-option-count', 'aria-hidden': 'true' }, option.count),
    ]);
  });

  return createElement('div', {
    className: 'facet-options',
    role: 'group',
    'aria-label': message(state.lang, 'filterOptions'),
  }, optionRows);
}

function chronologyControl(view, handlers) {
  const { state } = view;
  const { min, max } = state.filters.years;
  const [extentMin, extentMax] = state.filters.yearExtent;
  const start = createElement('input', {
    id: 'filter-year-from',
    type: 'number',
    min: extentMin,
    max,
    value: min,
    inputMode: 'numeric',
    on: { change: (event) => dispatch(handlers, { type: 'years/set', min: Number(event.target.value), max }) },
  });
  const end = createElement('input', {
    id: 'filter-year-to',
    type: 'number',
    min,
    max: extentMax,
    value: max,
    inputMode: 'numeric',
    on: { change: (event) => dispatch(handlers, { type: 'years/set', min, max: Number(event.target.value) }) },
  });
  return createElement('fieldset', { className: 'chronology-filter' }, [
    createElement('legend', {}, vocabularyLabel('facet', 'chronology', state.lang)),
    createElement('div', { className: 'chronology-inputs' }, [
      createElement('label', {}, [message(state.lang, 'chronologyFrom'), start]),
      createElement('span', { 'aria-hidden': 'true' }, '—'),
      createElement('label', {}, [message(state.lang, 'chronologyTo'), end]),
    ]),
    createElement('p', { className: 'chronology-readable' }, `${formatYear(min, state.lang)} — ${formatYear(max, state.lang)}`),
  ]);
}

export function renderFilters(root, view, handlers = {}) {
  const { state } = view;
  const search = createElement('label', { className: 'facet-search' }, [
    createElement('span', { className: 'visually-hidden' }, message(state.lang, 'optionSearch')),
    createElement('input', {
      type: 'search',
      value: state.facetQuery,
      placeholder: message(state.lang, 'optionSearch'),
      on: { input: (event) => dispatch(handlers, { type: 'facet-query/set', query: event.target.value }) },
    }),
  ]);
  replaceChildren(root, [
    facetNavigation(state, state.lang, handlers),
    createElement('div', { className: 'facet-body' }, [search, facetOptions(view, handlers)]),
    chronologyControl(view, handlers),
  ]);
  root.setAttribute('aria-busy', 'false');
}

function percentageLabel(value, lang) {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'el-GR', {
    maximumFractionDigits: 1,
  }).format(value);
}

function statisticsAction(group, value, yearExtent) {
  if (group !== 'period') return { type: 'filter/toggle', facet: group, value };
  const [rawMin, rawMax] = PERIOD_RANGES[value] ?? yearExtent;
  return {
    type: 'years/set',
    min: Math.max(yearExtent[0], rawMin),
    max: Math.min(yearExtent[1], rawMax),
  };
}

export function renderStatistics(root, view, handlers = {}) {
  const { state, derived } = view;
  const groups = STATISTICS_GROUPS.map(([group, labelGroup]) => {
    const items = derived.statistics[group] ?? [];
    if (!items.length) return null;
    return createElement('section', { className: 'statistics-group' }, [
      createElement('h3', {}, vocabularyLabel('facet', labelGroup, state.lang)),
      createElement('div', { className: 'statistics-bars' }, items.map((item) => {
        const percent = percentageLabel(item.percentage, state.lang);
        return createElement('button', {
          type: 'button',
          className: 'statistic-bar',
          dataset: { statFacet: group, statValue: item.value },
          style: { '--bar-size': `${item.percentage}%` },
          'aria-label': `${item.label}: ${item.count}, ${percent}%`,
          on: {
            click: () => dispatch(handlers, statisticsAction(group, item.value, state.filters.yearExtent)),
          },
        }, [
          createElement('span', { className: 'statistic-fill', 'aria-hidden': 'true' }),
          createElement('span', { className: 'statistic-label' }, item.label),
          createElement('strong', { className: 'statistic-count' }, item.count),
          createElement('span', { className: 'statistic-percent' }, `${percent}%`),
        ]);
      })),
    ]);
  });
  replaceChildren(root, groups);
  root.setAttribute('aria-busy', 'false');
}

function selectedFilterChips(view, handlers) {
  const { state, model } = view;
  const chips = [];
  for (const facet of FACETS) {
    for (const value of state.filters.facets[facet] ?? []) {
      const options = state.activeFacet === facet
        ? view.derived.facetOptions
        : [];
      const label = options.find((option) => option.value === value)?.label
        ?? (facet === 'country'
          ? model.entities.find((entity) => entity.place.countryCode === value)?.place.country[state.lang]
          : facet === 'ancientRegion'
            ? model.entities.find((entity) => entity.region.id === value)?.region[state.lang]
            : vocabularyLabel(facet, value, state.lang));
      chips.push(createElement('button', {
        type: 'button',
        className: 'filter-chip',
        dataset: { chipFacet: facet, chipValue: value },
        'aria-label': `${message(state.lang, 'clear')}: ${label}`,
        on: { click: () => dispatch(handlers, { type: 'filter/toggle', facet, value }) },
      }, [label || value, createElement('span', { 'aria-hidden': 'true' }, '×')]));
    }
  }
  return chips;
}

function updateTabs(elements, state) {
  for (const tab of elements.tabs ?? []) {
    const active = tab.dataset.tab === state.activeTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  }
  for (const [name, panel] of Object.entries(elements.panels ?? {})) {
    const active = name === state.activeTab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  }
}

export function renderWorkbench(elements, view, handlers = {}) {
  const { state, derived } = view;
  const catalogueHandlers = {
    ...handlers,
    onOpenDetails: handlers.onOpenDetails ?? ((entityId) => dispatch(handlers, { type: 'entity/select', entityId })),
  };

  updateTabs(elements, state);
  if (elements.app) elements.app.dataset.sheetOpen = String(state.mobileSheetOpen);

  const count = message(state.lang, 'resultCount', { count: derived.total });
  if (elements.resultCount) elements.resultCount.textContent = count;
  if (elements.statisticsCount) elements.statisticsCount.textContent = count;
  if (elements.resultList) {
    elements.resultList.hidden = derived.total === 0;
    renderCatalogue(elements.resultList, {
      entities: derived.entities,
      lang: state.lang,
      query: state.query,
      selectedEntityId: state.selectedEntityId,
    }, catalogueHandlers);
  }
  if (elements.emptyState) elements.emptyState.hidden = derived.total !== 0;

  if (elements.filterBadge) {
    elements.filterBadge.textContent = String(derived.activeFilterCount);
    elements.filterBadge.hidden = derived.activeFilterCount === 0;
  }
  if (elements.resetFilters) elements.resetFilters.disabled = derived.activeFilterCount === 0;
  if (elements.showResults) elements.showResults.textContent = message(state.lang, 'showResults', { count: derived.total });

  for (const chipRoot of [elements.activeFilterSummary, elements.activeFilterChips].filter(Boolean)) {
    const chips = selectedFilterChips(view, handlers);
    replaceChildren(chipRoot, chips);
    chipRoot.hidden = chips.length === 0;
  }

  if (elements.facetPicker) renderFilters(elements.facetPicker, view, handlers);

  if (elements.searchInput && elements.searchInput.value !== state.query) elements.searchInput.value = state.query;
  if (elements.clearSearch) elements.clearSearch.hidden = !state.query;
  if (elements.searchSummary) {
    elements.searchSummary.textContent = state.query
      ? message(state.lang, 'resultCount', { count: derived.total })
      : message(state.lang, 'searchHint');
  }
  if (elements.searchResults) {
    if (state.query) {
      renderCatalogue(elements.searchResults, {
        entities: derived.entities,
        lang: state.lang,
        query: state.query,
        selectedEntityId: state.selectedEntityId,
      }, catalogueHandlers);
    } else replaceChildren(elements.searchResults);
  }

  if (elements.statisticsContent) renderStatistics(elements.statisticsContent, view, handlers);
}
