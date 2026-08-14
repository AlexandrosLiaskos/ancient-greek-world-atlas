import {
  formatCoordinates,
  formatDateRange,
  localized,
  message,
  vocabularyLabel,
} from './i18n.js';
import { createElement, replaceChildren } from './render.js';

const dialogTriggers = new WeakMap();

function firstNonEmpty(...values) {
  return values.find((value) => String(value ?? '').trim()) ?? '';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function groupSources(sources = []) {
  const groups = new Map();
  for (const source of sources) {
    const key = String(source.id || source.url || source.citation || source.title || '').trim();
    if (!key) continue;
    const current = groups.get(key) ?? {
      id: source.id || key,
      title: source.title ?? '',
      publisher: source.publisher ?? '',
      url: safeExternalUrl(source.url),
      citation: source.citation ?? '',
      isPrimary: Boolean(source.isPrimary),
      scopes: new Set(),
    };
    current.title = firstNonEmpty(current.title, source.title);
    current.publisher = firstNonEmpty(current.publisher, source.publisher);
    current.url = firstNonEmpty(current.url, safeExternalUrl(source.url));
    current.citation = firstNonEmpty(current.citation, source.citation);
    current.isPrimary ||= Boolean(source.isPrimary);
    for (const scope of source.scopes ?? (source.scope ? [source.scope] : [])) {
      if (String(scope).trim()) current.scopes.add(String(scope).trim());
    }
    groups.set(key, current);
  }
  return Object.freeze([...groups.values()]
    .map((source) => Object.freeze({
      ...source,
      scopes: Object.freeze([...source.scopes].sort()),
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title)));
}

function relationModel(relation, atlas, lang) {
  const targetEntity = relation.targetEntityId
    ? atlas.entitiesById?.get(relation.targetEntityId)
    : null;
  const targetAuthority = relation.targetAuthorityId
    ? atlas.authoritiesById?.get(relation.targetAuthorityId)
    : null;
  return Object.freeze({
    id: relation.id,
    predicate: relation.predicate,
    predicateLabel: vocabularyLabel('predicate', relation.predicate, lang),
    target: localized(targetEntity?.name, lang)
      || localized(targetAuthority, lang)
      || localized(relation.target, lang)
      || relation.targetEntityId
      || relation.targetAuthorityId
      || '',
    targetEntityId: targetEntity ? targetEntity.id : null,
    targetAuthorityId: targetAuthority?.id ?? relation.targetAuthorityId ?? null,
    certainty: vocabularyLabel('confidence', relation.certainty, lang),
    sourceId: relation.sourceId,
    reviewState: vocabularyLabel('reviewState', relation.reviewState, lang),
  });
}

function chronologyModel(chronology, lang) {
  return Object.freeze({
    id: chronology.id,
    label: formatDateRange(chronology, lang),
    basis: vocabularyLabel('chronologyBasis', chronology.basis, lang),
    note: localized(chronology.note, lang),
    startPrecision: vocabularyLabel('precision', chronology.startPrecision, lang),
    endPrecision: vocabularyLabel('precision', chronology.endPrecision, lang),
    temporalPrecision: vocabularyLabel('precision', chronology.temporalPrecision, lang),
    displayCutoff: Boolean(chronology.displayCutoff),
    sourceId: chronology.sourceId,
    reviewState: vocabularyLabel('reviewState', chronology.reviewState, lang),
  });
}

function sourceModel(source, lang) {
  return Object.freeze({
    ...source,
    scopeLabels: Object.freeze(source.scopes.map((scope) => vocabularyLabel('sourceScope', scope, lang))),
  });
}

export function buildDetailsModel(entity, atlas, lang = 'el') {
  if (!entity) throw new TypeError('An entity is required.');
  const sourceGroups = groupSources(entity.sources).map((source) => sourceModel(source, lang));
  const place = entity.place;
  const coordinateText = `${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`;
  return Object.freeze({
    id: entity.id,
    lang,
    title: localized(entity.name, lang),
    ancientName: entity.ancientName ?? '',
    aliases: Object.freeze((entity.aliases ?? [])
      .filter(({ value }) => value && value !== entity.ancientName)
      .map((alias) => Object.freeze({ ...alias }))),
    entityClass: entity.entityClass,
    classLabel: vocabularyLabel('entityClass', entity.entityClass, lang),
    subtype: String(entity.subtype ?? '').replaceAll('_', ' '),
    collections: Object.freeze((entity.collections ?? []).map((value) => Object.freeze({
      value,
      label: vocabularyLabel('collection', value, lang),
    }))),
    description: localized(entity.description, lang),
    chronologies: Object.freeze((entity.chronologies ?? []).map((chronology) => chronologyModel(chronology, lang))),
    place: Object.freeze({
      locality: place.locality,
      country: localized(place.country, lang),
      countryCode: place.countryCode,
      region: localized(entity.region, lang),
      coordinates: formatCoordinates(place.latitude, place.longitude, lang),
      coordinateText,
      latitude: place.latitude,
      longitude: place.longitude,
      geometryRoleValue: place.geometryRole,
      geometryRole: vocabularyLabel('geometryRole', place.geometryRole, lang),
      certainty: vocabularyLabel('confidence', place.certainty, lang),
      precision: vocabularyLabel('precision', place.precision, lang),
      spatialNote: localized(place.spatialNote, lang),
      sourceText: place.sourceText,
      sourceId: place.sourceId,
    }),
    relationships: Object.freeze((entity.relationships ?? []).map((relation) => relationModel(relation, atlas, lang))),
    sourceGroups: Object.freeze(sourceGroups),
    externalIds: Object.freeze((entity.externalIds ?? []).map((external) => Object.freeze({
      ...external,
      uri: safeExternalUrl(external.uri),
      label: external.scheme === 'pleiades'
        ? `Pleiades ${external.identifier}`
        : `${external.scheme}: ${external.identifier}`,
    }))),
    editorial: Object.freeze({
      confidence: vocabularyLabel('confidence', entity.confidence, lang),
      reviewState: vocabularyLabel('reviewState', entity.reviewState, lang),
      translationStatus: vocabularyLabel('translationStatus', entity.translationStatus, lang),
      temporalPrecision: vocabularyLabel('precision', entity.temporalPrecision, lang),
      lastReviewed: entity.lastReviewed,
      reviewer: entity.reviewer,
      dataVersion: entity.dataVersion,
    }),
  });
}

function section(title, children, className = '') {
  return createElement('section', { className: `record-section ${className}`.trim() }, [
    createElement('h3', {}, title),
    ...[children].flat(Infinity),
  ]);
}

function definitionList(rows) {
  const children = [];
  for (const [label, value] of rows) {
    if (!String(value ?? '').trim()) continue;
    children.push(createElement('dt', {}, label), createElement('dd', {}, value));
  }
  return createElement('dl', { className: 'record-definitions' }, children);
}

function externalLink(href, label, className = '') {
  return createElement('a', {
    className,
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
  }, label);
}

function renderChronologies(model) {
  return createElement('ol', { className: 'chronology-list' }, model.chronologies.map((chronology) => (
    createElement('li', { className: 'chronology-entry' }, [
      createElement('div', { className: 'chronology-heading' }, [
        createElement('strong', {}, chronology.label),
        createElement('span', {}, chronology.basis),
      ]),
      chronology.note ? createElement('p', {}, chronology.note) : null,
      definitionList([
        [model.lang === 'el' ? 'Έναρξη' : 'Start', chronology.startPrecision],
        [model.lang === 'el' ? 'Λήξη' : 'End', chronology.endPrecision],
        [model.lang === 'el' ? 'Συνολική ακρίβεια' : 'Overall precision', chronology.temporalPrecision],
      ]),
    ])
  )));
}

function renderRelationships(model, handlers) {
  if (!model.relationships.length) return createElement('p', { className: 'record-empty' }, message(model.lang, 'noRelationships'));
  return createElement('ul', { className: 'relationship-list' }, model.relationships.map((relation) => {
    const target = relation.targetEntityId
      ? createElement('button', {
        type: 'button',
        className: 'relationship-target',
        dataset: { relatedEntity: relation.targetEntityId },
        on: { click: () => handlers.onNavigateEntity?.(relation.targetEntityId) },
      }, relation.target)
      : createElement('span', { className: 'relationship-target-text' }, relation.target);
    return createElement('li', {}, [
      createElement('span', { className: 'relationship-predicate' }, relation.predicateLabel),
      target,
      relation.certainty ? createElement('span', { className: 'relationship-certainty' }, relation.certainty) : null,
    ]);
  }));
}

function renderSources(model) {
  if (!model.sourceGroups.length) return createElement('p', { className: 'record-empty' }, message(model.lang, 'noSources'));
  return createElement('ol', { className: 'source-list' }, model.sourceGroups.map((source) => (
    createElement('li', { className: 'source-entry' }, [
      createElement('div', { className: 'source-heading' }, [
        source.url
          ? externalLink(source.url, source.title || source.citation || source.id)
          : createElement('strong', {}, source.title || source.citation || source.id),
        source.isPrimary ? createElement('span', { className: 'source-primary' }, message(model.lang, 'primarySource')) : null,
      ]),
      source.publisher ? createElement('p', { className: 'source-publisher' }, source.publisher) : null,
      source.citation && source.citation !== source.title
        ? createElement('p', { className: 'source-citation' }, source.citation)
        : null,
      source.scopeLabels.length
        ? createElement('p', { className: 'source-scopes' }, [
          createElement('strong', {}, `${message(model.lang, 'sourceScopes')}: `),
          source.scopeLabels.join(' · '),
        ])
        : null,
    ])
  )));
}

function renderIdentifiers(model) {
  return createElement('ul', { className: 'identifier-list' }, model.externalIds.map((external) => (
    createElement('li', {}, external.uri
      ? externalLink(external.uri, external.label)
      : createElement('span', {}, external.label))
  )));
}

export function renderDetails(dialog, model, handlers = {}) {
  const title = dialog.querySelector('#record-title');
  const content = dialog.querySelector('#record-content');
  if (!title || !content) throw new TypeError('The record dialog is missing its title or content region.');
  title.textContent = model.title;

  const lede = createElement('header', { className: `record-lede type-${model.entityClass}` }, [
    createElement('span', { className: `record-symbol marker-${model.entityClass}`, 'aria-hidden': 'true' }),
    createElement('div', { className: 'record-lede-copy' }, [
      model.ancientName ? createElement('p', { className: 'record-ancient', lang: 'grc' }, model.ancientName) : null,
      createElement('p', { className: 'record-classification' }, [
        model.classLabel,
        ...model.collections.map(({ label }) => ` · ${label}`),
      ]),
      model.aliases.length
        ? createElement('p', { className: 'record-aliases' }, `${message(model.lang, 'aliases')}: ${model.aliases.map(({ value }) => value).join(' · ')}`)
        : null,
    ]),
  ]);

  const geography = definitionList([
    [message(model.lang, 'modernLocality'), model.place.locality],
    [message(model.lang, 'modernCountry'), model.place.country],
    [message(model.lang, 'ancientRegion'), model.place.region],
    [message(model.lang, 'spatialRole'), model.place.geometryRole],
    [message(model.lang, 'locationPrecision'), model.place.precision],
    [message(model.lang, 'coordinateSource'), model.place.sourceText],
  ]);
  const coordinateButton = createElement('button', {
    type: 'button',
    className: 'coordinate-copy',
    dataset: { coordinateText: model.place.coordinateText },
    on: {
      click: () => {
        if (handlers.onCopyCoordinates) handlers.onCopyCoordinates(model.place);
        else copyCoordinates(model.place.latitude, model.place.longitude, {
          onStatus: handlers.onCopyStatus,
          lang: model.lang,
        });
      },
    },
  }, [
    createElement('span', {}, model.place.coordinates),
    createElement('span', { className: 'coordinate-copy-label' }, message(model.lang, 'copyCoordinates')),
  ]);

  replaceChildren(content, [
    lede,
    section(message(model.lang, 'description'), createElement('p', { className: 'record-description' }, model.description || message(model.lang, 'noDescription'))),
    section(message(model.lang, 'chronology'), renderChronologies(model)),
    section(message(model.lang, 'geography'), [coordinateButton, geography, model.place.spatialNote ? createElement('p', { className: 'spatial-note' }, model.place.spatialNote) : null]),
    section(message(model.lang, 'relationships'), renderRelationships(model, handlers)),
    section(message(model.lang, 'sources'), renderSources(model)),
    model.externalIds.length ? section(message(model.lang, 'identifiers'), renderIdentifiers(model)) : null,
    section(message(model.lang, 'editorialStatus'), definitionList([
      [message(model.lang, 'recordConfidence'), model.editorial.confidence],
      [message(model.lang, 'reviewState'), model.editorial.reviewState],
      [message(model.lang, 'translationStatus'), model.editorial.translationStatus],
      [message(model.lang, 'lastReviewed'), model.editorial.lastReviewed],
      [message(model.lang, 'reviewer'), model.editorial.reviewer],
      [message(model.lang, 'dataVersion'), model.editorial.dataVersion],
    ]), 'record-editorial'),
  ]);
}

export async function copyCoordinates(latitude, longitude, options = {}) {
  const text = `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
  const navigatorObject = options.navigatorObject ?? globalThis.navigator;
  const documentObject = options.documentObject ?? globalThis.document;
  const lang = options.lang === 'en' ? 'en' : 'el';
  try {
    if (navigatorObject?.clipboard?.writeText) {
      await navigatorObject.clipboard.writeText(text);
    } else {
      const textarea = documentObject.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      documentObject.body.append(textarea);
      textarea.select();
      const copied = documentObject.execCommand?.('copy');
      textarea.remove();
      if (!copied) throw new Error('Legacy clipboard copy failed.');
    }
    options.onStatus?.(message(lang, 'coordinatesCopied'), true);
    return true;
  } catch {
    options.onStatus?.(message(lang, 'coordinatesCopyFailed'), false);
    return false;
  }
}

export function openDetails(dialog, trigger = null) {
  if (trigger) dialogTriggers.set(dialog, trigger);
  if (!dialog.open) dialog.showModal();
  const closeButton = dialog.querySelector('#record-close');
  closeButton?.focus();
}

export function closeDetails(dialog) {
  if (dialog.open) dialog.close();
  const trigger = dialogTriggers.get(dialog);
  dialogTriggers.delete(dialog);
  if (trigger?.isConnected) trigger.focus();
}

