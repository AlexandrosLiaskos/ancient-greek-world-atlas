import { localized } from './i18n.js';

const COMBINING_MARKS = /\p{M}+/gu;
const NON_SEARCH_CHARACTERS = /[^\p{L}\p{N}]+/gu;

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLocaleLowerCase('el-GR')
    .replaceAll('ς', 'σ')
    .replace(NON_SEARCH_CHARACTERS, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function weightedFields(entity) {
  const classification = [
    entity.entityClass,
    entity.subtype,
    ...(entity.collections ?? []),
    entity.place?.geometryRole,
    entity.confidence,
  ].filter(Boolean).join(' ');

  return [
    { text: `${entity.name?.el ?? ''} ${entity.name?.en ?? ''}`, weight: 100 },
    {
      text: [entity.name?.grc, entity.ancientName, ...(entity.aliases ?? []).map(({ value }) => value)]
        .filter(Boolean)
        .join(' '),
      weight: 70,
    },
    {
      text: [
        entity.place?.locality,
        entity.place?.country?.el,
        entity.place?.country?.en,
        entity.region?.el,
        entity.region?.en,
      ].filter(Boolean).join(' '),
      weight: 35,
    },
    { text: classification, weight: 20 },
    { text: `${entity.description?.el ?? ''} ${entity.description?.en ?? ''}`, weight: 10 },
  ]
    .map(({ text, weight }) => ({ text: normalizeSearchText(text), weight }))
    .filter(({ text }) => text);
}

export function createSearchIndex(entities) {
  if (!Array.isArray(entities)) throw new TypeError('Search entities must be an array.');
  return Object.freeze(entities.map((entity) => Object.freeze({
    id: entity.id,
    fields: Object.freeze(weightedFields(entity).map(Object.freeze)),
    entity,
  })));
}

function fieldScore(field, token) {
  if (!field.text.includes(token)) return 0;
  const words = field.text.split(' ');
  if (field.text === token) return field.weight * 1.5;
  if (words.some((word) => word.startsWith(token))) return field.weight * 1.25;
  return field.weight;
}

export function search(index, query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return new Map();
  const tokens = [...new Set(normalized.split(' ').filter(Boolean))];
  const matches = [];

  for (const entry of index) {
    let score = 0;
    let complete = true;
    for (const token of tokens) {
      const best = Math.max(0, ...entry.fields.map((field) => fieldScore(field, token)));
      if (!best) {
        complete = false;
        break;
      }
      score += best;
    }
    if (complete) matches.push([entry.id, score]);
  }

  matches.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
  return new Map(matches);
}

function normalizeWithOffsets(text) {
  let normalized = '';
  const offsets = [];
  let sourceOffset = 0;

  for (const character of String(text ?? '')) {
    const start = sourceOffset;
    sourceOffset += character.length;
    const folded = character
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .toLocaleLowerCase('el-GR')
      .replaceAll('ς', 'σ');
    const searchable = folded.replace(NON_SEARCH_CHARACTERS, ' ');
    for (const normalizedCharacter of searchable) {
      normalized += normalizedCharacter;
      offsets.push([start, sourceOffset]);
    }
  }

  return { normalized, offsets };
}

export function highlightRanges(text, query) {
  const tokens = [...new Set(normalizeSearchText(query).split(' ').filter(Boolean))];
  if (!tokens.length) return [];
  const { normalized, offsets } = normalizeWithOffsets(text);
  const ranges = [];

  for (const token of tokens) {
    let from = 0;
    while (from < normalized.length) {
      const index = normalized.indexOf(token, from);
      if (index < 0) break;
      const first = offsets[index];
      const last = offsets[index + token.length - 1];
      if (first && last) ranges.push([first[0], last[1]]);
      from = index + token.length;
    }
  }

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function searchDisplayName(entity, lang) {
  return localized(entity.name, lang);
}
