import { localeFor, localized, vocabularyLabel } from './i18n.js';

export const FACETS = Object.freeze([
  'entityClass',
  'collection',
  'country',
  'ancientRegion',
  'confidence',
  'geometryRole',
]);

const FIXED_ORDER = Object.freeze({
  entityClass: Object.freeze(['settlement', 'sanctuary', 'polity']),
  collection: Object.freeze(['city', 'colony', 'sanctuary', 'kingdom']),
  confidence: Object.freeze(['high', 'medium', 'low']),
  geometryRole: Object.freeze(['site', 'proxy', 'representative_center']),
});

export function createEmptyFacets() {
  return Object.fromEntries(FACETS.map((facet) => [facet, []]));
}

function valuesFor(entity, facet) {
  switch (facet) {
    case 'entityClass': return entity.entityClass ? [entity.entityClass] : [];
    case 'collection': return entity.collections ?? [];
    case 'country': return entity.place?.countryCode ? [entity.place.countryCode] : [];
    case 'ancientRegion': return entity.region?.id ? [entity.region.id] : [];
    case 'confidence': return entity.confidence ? [entity.confidence] : [];
    case 'geometryRole': return entity.place?.geometryRole ? [entity.place.geometryRole] : [];
    default: throw new RangeError(`Unknown facet: ${facet}`);
  }
}

function matchesFacet(entity, facet, selected) {
  if (!selected?.length) return true;
  const values = valuesFor(entity, facet);
  return selected.some((value) => values.includes(value));
}

function overlapsYears(entity, years) {
  if (!years) return true;
  const minimum = Number.isFinite(Number(years.min)) ? Number(years.min) : Number.NEGATIVE_INFINITY;
  const maximum = Number.isFinite(Number(years.max)) ? Number(years.max) : Number.POSITIVE_INFINITY;
  const start = Number.isFinite(entity.startYear) ? entity.startYear : entity.endYear;
  const end = Number.isFinite(entity.endYear) ? entity.endYear : entity.startYear;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return start <= maximum && end >= minimum;
}

export function filterEntities(entities, filterState, scores = null, lang = 'el') {
  const facets = filterState?.facets ?? {};
  const matches = entities.filter((entity) => {
    if (scores instanceof Map && !scores.has(entity.id)) return false;
    if (!overlapsYears(entity, filterState?.years)) return false;
    return FACETS.every((facet) => matchesFacet(entity, facet, facets[facet]));
  });

  const collator = new Intl.Collator(localeFor(lang), { sensitivity: 'base', numeric: true });
  return matches.sort((a, b) => {
    if (scores instanceof Map) {
      const scoreDifference = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      if (scoreDifference) return scoreDifference;
    }
    return collator.compare(localized(a.name, lang), localized(b.name, lang)) || a.id.localeCompare(b.id);
  });
}

function optionLabel(entities, facet, value, lang) {
  if (facet === 'country') {
    const entity = entities.find((item) => item.place?.countryCode === value);
    return localized(entity?.place?.country, lang) || value;
  }
  if (facet === 'ancientRegion') {
    const entity = entities.find((item) => item.region?.id === value);
    return localized(entity?.region, lang) || value;
  }
  return vocabularyLabel(facet, value, lang);
}

function fixedRank(facet, value) {
  const index = FIXED_ORDER[facet]?.indexOf(value) ?? -1;
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function getFacetOptions(entities, filterState, facet, lang = 'el') {
  if (!FACETS.includes(facet)) throw new RangeError(`Unknown facet: ${facet}`);
  const selected = filterState?.facets?.[facet] ?? [];
  const facetsWithoutCurrent = {
    ...(filterState?.facets ?? {}),
    [facet]: [],
  };
  const contextualEntities = filterEntities(entities, {
    ...filterState,
    facets: facetsWithoutCurrent,
  }, null, lang);
  const values = new Set(selected);
  const counts = new Map();

  for (const entity of entities) {
    for (const value of valuesFor(entity, facet)) values.add(value);
  }
  for (const entity of contextualEntities) {
    for (const value of new Set(valuesFor(entity, facet))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const collator = new Intl.Collator(localeFor(lang), { sensitivity: 'base', numeric: true });
  return [...values]
    .map((value) => {
      const count = counts.get(value) ?? 0;
      const isSelected = selected.includes(value);
      return Object.freeze({
        value,
        label: optionLabel(entities, facet, value, lang),
        count,
        selected: isSelected,
        disabled: count === 0 && !isSelected,
      });
    })
    .sort((a, b) => (
      fixedRank(facet, a.value) - fixedRank(facet, b.value)
      || collator.compare(a.label, b.label)
      || a.value.localeCompare(b.value)
    ));
}

export function countActiveFilters(filterState) {
  const facetCount = FACETS.reduce(
    (total, facet) => total + (filterState?.facets?.[facet]?.length ?? 0),
    0,
  );
  const [minimum, maximum] = filterState?.yearExtent ?? [];
  const narrowedYears = Number.isFinite(minimum)
    && Number.isFinite(maximum)
    && (Number(filterState?.years?.min) !== minimum || Number(filterState?.years?.max) !== maximum);
  return facetCount + (narrowedYears ? 1 : 0);
}
