import {
  formatDateRange,
  localized,
  message,
  vocabularyLabel,
} from './i18n.js';
import { highlightRanges } from './search.js';

function compactUnique(values) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function primaryChronology(entity) {
  return entity.chronologies?.find(({ displayCutoff }) => displayCutoff)
    ?? entity.chronologies?.[0]
    ?? null;
}

function placeLabel(entity, lang) {
  return compactUnique([
    entity.place?.locality,
    localized(entity.place?.country, lang),
  ]).join(' · ');
}

export function buildCatalogueRows(entities, lang = 'el', query = '') {
  return entities.map((entity) => {
    const title = localized(entity.name, lang);
    const chronology = primaryChronology(entity);
    const geometryRole = entity.place?.geometryRole ?? '';
    const collectionLabels = (entity.collections ?? [])
      .map((value) => vocabularyLabel('collection', value, lang));

    return Object.freeze({
      id: entity.id,
      entityClass: entity.entityClass,
      title,
      titleMatches: Object.freeze(highlightRanges(title, query)),
      ancientName: entity.ancientName ?? '',
      classLabel: vocabularyLabel('entityClass', entity.entityClass, lang),
      collectionLabel: collectionLabels.join(' · '),
      location: placeLabel(entity, lang),
      date: chronology ? formatDateRange(chronology, lang) : '',
      confidence: entity.confidence,
      confidenceLabel: vocabularyLabel('confidence', entity.confidence, lang),
      geometryRole,
      geometryRoleLabel: vocabularyLabel('geometryRole', geometryRole, lang),
      uncertain: geometryRole === 'proxy' || geometryRole === 'representative_center',
    });
  });
}

function element(tagName, className = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}

function appendHighlighted(parent, text, ranges) {
  if (!ranges.length) {
    parent.append(document.createTextNode(text));
    return;
  }

  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parent.append(document.createTextNode(text.slice(cursor, start)));
    const mark = element('mark', 'catalogue-match');
    mark.textContent = text.slice(start, end);
    parent.append(mark);
    cursor = end;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function catalogueItem(row, selectedEntityId, lang, handlers) {
  const item = element('li', `catalogue-item type-${row.entityClass}`);
  const button = element('button', 'catalogue-row');
  button.type = 'button';
  button.dataset.entityId = row.id;
  button.setAttribute('aria-label', [
    row.title,
    row.ancientName,
    row.classLabel,
    row.location,
    row.date,
    row.uncertain ? row.geometryRoleLabel : '',
    message(lang, 'openRecord'),
  ].filter(Boolean).join('. '));
  if (selectedEntityId === row.id) {
    button.classList.add('is-selected');
    button.setAttribute('aria-current', 'true');
  }

  const symbol = element('span', `catalogue-symbol marker-${row.entityClass}`);
  symbol.setAttribute('aria-hidden', 'true');

  const copy = element('span', 'catalogue-copy');
  const heading = element('h3', 'catalogue-title');
  appendHighlighted(heading, row.title, row.titleMatches);
  copy.append(heading);

  if (row.ancientName && row.ancientName !== row.title) {
    const ancient = element('span', 'catalogue-ancient');
    ancient.lang = 'grc';
    ancient.textContent = row.ancientName;
    copy.append(ancient);
  }

  const classification = element('span', 'catalogue-classification');
  classification.textContent = compactUnique([row.classLabel, row.collectionLabel]).join(' · ');
  copy.append(classification);

  const metadata = element('span', 'catalogue-metadata');
  const location = element('span');
  location.textContent = row.location;
  const date = element('span');
  date.textContent = row.date;
  metadata.append(location, date);
  copy.append(metadata);

  if (row.uncertain) {
    const uncertainty = element('span', 'catalogue-uncertainty');
    uncertainty.textContent = row.geometryRoleLabel;
    copy.append(uncertainty);
  }

  const arrow = element('span', 'catalogue-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  button.append(symbol, copy, arrow);

  const preview = () => handlers.onPreview?.(row.id);
  const leave = () => handlers.onLeavePreview?.(row.id);
  button.addEventListener('pointerenter', preview);
  button.addEventListener('pointerleave', leave);
  button.addEventListener('focus', preview);
  button.addEventListener('blur', leave);
  button.addEventListener('click', () => handlers.onOpenDetails?.(row.id));
  item.append(button);
  return item;
}

export function renderCatalogue(root, model, handlers = {}) {
  const rows = buildCatalogueRows(model.entities ?? [], model.lang, model.query);
  root.replaceChildren(...rows.map((row) => (
    catalogueItem(row, model.selectedEntityId, model.lang, handlers)
  )));
  root.setAttribute('aria-busy', 'false');
}

