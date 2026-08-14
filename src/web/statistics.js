import { localeFor, localized, vocabularyLabel } from './i18n.js';

const PERIOD_ORDER = Object.freeze(['bronze', 'archaic', 'classical', 'hellenistic', 'roman', 'lateAntique']);
const CLASS_ORDER = Object.freeze(['settlement', 'sanctuary', 'polity']);
const COLLECTION_ORDER = Object.freeze(['city', 'colony', 'sanctuary', 'kingdom']);
const GEOMETRY_ORDER = Object.freeze(['site', 'proxy', 'representative_center']);
const CONFIDENCE_ORDER = Object.freeze(['high', 'medium', 'low']);

export function periodForYear(year) {
  const value = Number(year);
  if (!Number.isFinite(value)) return null;
  if (value <= -1100) return 'bronze';
  if (value <= -480) return 'archaic';
  if (value <= -323) return 'classical';
  if (value <= -31) return 'hellenistic';
  if (value <= 330) return 'roman';
  return 'lateAntique';
}

function percentage(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function distribution(values, total, labelFor, order = null, lang = 'el') {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  const collator = new Intl.Collator(localeFor(lang), { sensitivity: 'base', numeric: true });
  return [...counts]
    .map(([value, count]) => Object.freeze({
      value,
      label: labelFor(value),
      count,
      percentage: percentage(count, total),
    }))
    .sort((a, b) => {
      if (order) {
        const rankA = order.indexOf(a.value);
        const rankB = order.indexOf(b.value);
        return (rankA < 0 ? Number.MAX_SAFE_INTEGER : rankA)
          - (rankB < 0 ? Number.MAX_SAFE_INTEGER : rankB)
          || collator.compare(a.label, b.label);
      }
      return b.count - a.count || collator.compare(a.label, b.label);
    });
}

export function buildStatistics(entities, lang = 'el') {
  const total = entities.length;
  const countryLabels = new Map();
  for (const entity of entities) {
    if (entity.place?.countryCode && !countryLabels.has(entity.place.countryCode)) {
      countryLabels.set(entity.place.countryCode, localized(entity.place.country, lang) || entity.place.countryCode);
    }
  }

  return Object.freeze({
    total,
    entityClass: Object.freeze(distribution(
      entities.map(({ entityClass }) => entityClass),
      total,
      (value) => vocabularyLabel('entityClass', value, lang),
      CLASS_ORDER,
      lang,
    )),
    collection: Object.freeze(distribution(
      entities.flatMap(({ collections }) => collections ?? []),
      total,
      (value) => vocabularyLabel('collection', value, lang),
      COLLECTION_ORDER,
      lang,
    )),
    country: Object.freeze(distribution(
      entities.map(({ place }) => place?.countryCode),
      total,
      (value) => countryLabels.get(value) ?? value,
      null,
      lang,
    )),
    period: Object.freeze(distribution(
      entities.map(({ startYear }) => periodForYear(startYear)),
      total,
      (value) => vocabularyLabel('period', value, lang),
      PERIOD_ORDER,
      lang,
    )),
    geometryRole: Object.freeze(distribution(
      entities.map(({ place }) => place?.geometryRole),
      total,
      (value) => vocabularyLabel('geometryRole', value, lang),
      GEOMETRY_ORDER,
      lang,
    )),
    confidence: Object.freeze(distribution(
      entities.map(({ confidence }) => confidence),
      total,
      (value) => vocabularyLabel('confidence', value, lang),
      CONFIDENCE_ORDER,
      lang,
    )),
  });
}

export { PERIOD_ORDER };
