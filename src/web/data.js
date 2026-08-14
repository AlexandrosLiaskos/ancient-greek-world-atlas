const DEFAULT_DATA_URL = './dist/ancient-greek-world.json';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicPair(el, en) {
  return Object.freeze({ el: nonEmpty(el), en: nonEmpty(en) });
}

function adaptAuthority(raw) {
  if (!raw || !nonEmpty(raw.authority_id)) throw new TypeError('Authority is missing an id.');
  return Object.freeze({
    id: raw.authority_id,
    type: nonEmpty(raw.authority_type),
    el: nonEmpty(raw.preferred_label_el),
    en: nonEmpty(raw.preferred_label_en),
    uri: nonEmpty(raw.uri) || null,
    sourceId: nonEmpty(raw.source_id) || null,
    reviewState: nonEmpty(raw.review_state),
  });
}

function adaptPlace(raw, entityId) {
  const latitude = numberOrNull(raw?.latitude);
  const longitude = numberOrNull(raw?.longitude);
  const geometry = raw?.geometry_geojson;
  const coordinates = geometry?.coordinates;
  const usable = geometry?.type === 'Point'
    && Array.isArray(coordinates)
    && coordinates.length >= 2
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;

  if (!usable) throw new TypeError(`Entity ${entityId} has no usable point.`);

  return Object.freeze({
    id: nonEmpty(raw.place_id),
    latitude,
    longitude,
    geometryRole: nonEmpty(raw.geometry_role),
    certainty: nonEmpty(raw.location_certainty),
    precision: nonEmpty(raw.location_precision),
    countryCode: nonEmpty(raw.country_iso3),
    countryCode2: nonEmpty(raw.country_iso2),
    country: publicPair(raw.modern_country_el, raw.modern_country_en),
    locality: nonEmpty(raw.modern_locality),
    spatialNote: publicPair(raw.spatial_note_el, raw.spatial_note_en),
    sourceText: nonEmpty(raw.coordinate_source_text),
    sourceId: nonEmpty(raw.source_id) || null,
  });
}

function adaptChronology(raw) {
  return Object.freeze({
    id: nonEmpty(raw.chronology_id),
    basis: nonEmpty(raw.chronology_basis),
    startYear: numberOrNull(raw.start_year),
    endYear: numberOrNull(raw.end_year),
    startPrecision: nonEmpty(raw.start_precision),
    endPrecision: nonEmpty(raw.end_precision),
    temporalPrecision: nonEmpty(raw.temporal_precision),
    displayCutoff: Boolean(raw.display_cutoff),
    label: publicPair(raw.label_el, raw.label_en),
    note: publicPair(raw.note_el, raw.note_en),
    sourceId: nonEmpty(raw.source_id) || null,
    reviewState: nonEmpty(raw.review_state),
  });
}

function adaptRelationships(rows = []) {
  return Object.freeze(rows.map((raw) => Object.freeze({
    id: nonEmpty(raw.relationship_id),
    predicate: nonEmpty(raw.predicate),
    certainty: nonEmpty(raw.certainty),
    targetEntityId: nonEmpty(raw.object_entity_id) || null,
    targetAuthorityId: nonEmpty(raw.object_authority_id) || null,
    target: publicPair(raw.object_label_el, raw.object_label_en),
    sourceId: nonEmpty(raw.source_id) || null,
    reviewState: nonEmpty(raw.review_state),
  })));
}

function adaptSources(rows = []) {
  const grouped = new Map();

  for (const raw of rows) {
    const id = nonEmpty(raw.source_id);
    if (!id) continue;
    const current = grouped.get(id) ?? {
      id,
      title: nonEmpty(raw.title),
      publisher: nonEmpty(raw.publisher),
      url: nonEmpty(raw.url),
      citation: nonEmpty(raw.citation),
      isPrimary: Boolean(raw.is_primary),
      scopes: new Set(),
    };
    const scope = nonEmpty(raw.support_scope);
    if (scope) current.scopes.add(scope);
    grouped.set(id, current);
  }

  return Object.freeze([...grouped.values()].map((source) => Object.freeze({
    ...source,
    scopes: Object.freeze([...source.scopes].sort()),
  })));
}

function adaptEntity(raw, authoritiesById) {
  const id = nonEmpty(raw?.entity_id);
  if (!id) throw new TypeError('Entity is missing an id.');
  const nameEl = nonEmpty(raw.preferred_name_el);
  const nameEn = nonEmpty(raw.preferred_name_en);
  if (!nameEl || !nameEn) throw new TypeError(`Entity ${id} is missing a public name.`);

  const place = adaptPlace(raw.places?.[0], id);
  const chronologies = Object.freeze((raw.chronologies ?? []).map(adaptChronology));
  const starts = chronologies.map(({ startYear }) => startYear).filter(Number.isFinite);
  const ends = chronologies.map(({ endYear }) => endYear).filter(Number.isFinite);
  const names = Array.isArray(raw.names) ? raw.names : [];
  const ancientName = nonEmpty(raw.ancient_name_grc)
    || nonEmpty(names.find(({ language, name_type }) => language === 'grc' && name_type === 'ancient')?.name);
  const regionId = nonEmpty(raw.ancient_region_authority_id) || null;
  const regionAuthority = regionId ? authoritiesById.get(regionId) : null;

  return Object.freeze({
    id,
    entityClass: nonEmpty(raw.entity_class),
    subtype: nonEmpty(raw.entity_subtype),
    collections: Object.freeze(
      String(raw.collections ?? '')
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    name: Object.freeze({ el: nameEl, en: nameEn, grc: ancientName }),
    description: publicPair(raw.description_el, raw.description_en),
    ancientName,
    aliases: Object.freeze(names
      .filter(({ is_preferred }) => !is_preferred)
      .map((name) => Object.freeze({
        value: nonEmpty(name.name),
        language: nonEmpty(name.language),
        type: nonEmpty(name.name_type),
        script: nonEmpty(name.script),
      }))
      .filter(({ value }) => value)),
    region: Object.freeze({
      id: regionId,
      el: regionAuthority?.el ?? '',
      en: regionAuthority?.en ?? '',
    }),
    place,
    chronologies,
    startYear: starts.length ? Math.min(...starts) : null,
    endYear: ends.length ? Math.max(...ends) : null,
    relationships: adaptRelationships(raw.relationships),
    sources: adaptSources(raw.source_support),
    externalIds: Object.freeze((raw.external_ids ?? []).map((external) => Object.freeze({
      id: nonEmpty(external.external_id),
      scheme: nonEmpty(external.scheme),
      identifier: nonEmpty(external.identifier),
      uri: nonEmpty(external.uri),
      matchType: nonEmpty(external.match_type),
      sourceId: nonEmpty(external.source_id) || null,
    }))),
    confidence: nonEmpty(raw.record_confidence),
    locationCertainty: nonEmpty(raw.location_certainty),
    temporalPrecision: nonEmpty(raw.temporal_precision),
    reviewState: nonEmpty(raw.review_state),
    translationStatus: nonEmpty(raw.translation_status),
    lastReviewed: nonEmpty(raw.last_reviewed),
    reviewer: nonEmpty(raw.reviewer),
    dataVersion: nonEmpty(raw.data_version),
    sanctuary: Object.freeze({
      functionTags: nonEmpty(raw.sanctuary_function_tags)
        ? Object.freeze(raw.sanctuary_function_tags.split('|').map((value) => value.trim()).filter(Boolean))
        : Object.freeze([]),
      scope: nonEmpty(raw.sanctuary_scope),
      setting: nonEmpty(raw.sanctuary_setting),
    }),
  });
}

export function adaptRelease(payload) {
  if (!payload || typeof payload.dataset !== 'object' || Array.isArray(payload.dataset)) {
    throw new TypeError('Atlas release is missing dataset metadata.');
  }
  if (!Array.isArray(payload.entities)) {
    throw new TypeError('Atlas release entities must be an array.');
  }
  if (!Array.isArray(payload.authorities)) {
    throw new TypeError('Atlas release authorities must be an array.');
  }

  const authorities = Object.freeze(payload.authorities.map(adaptAuthority));
  const authoritiesById = new Map(authorities.map((authority) => [authority.id, authority]));
  const entities = [];
  const entitiesById = new Map();

  for (const raw of payload.entities) {
    const entity = adaptEntity(raw, authoritiesById);
    if (entitiesById.has(entity.id)) throw new TypeError(`Duplicate entity id: ${entity.id}`);
    entities.push(entity);
    entitiesById.set(entity.id, entity);
  }

  if (!entities.length) throw new TypeError('Atlas release contains no entities.');

  const latitudes = entities.map(({ place }) => place.latitude);
  const longitudes = entities.map(({ place }) => place.longitude);
  const starts = entities.map(({ startYear }) => startYear).filter(Number.isFinite);
  const ends = entities.map(({ endYear }) => endYear).filter(Number.isFinite);
  const yearValues = [...starts, ...ends];

  return Object.freeze({
    dataset: Object.freeze({ ...payload.dataset }),
    entities: Object.freeze(entities),
    entitiesById,
    authorities,
    authoritiesById,
    sources: Object.freeze(Array.isArray(payload.sources) ? payload.sources.map((source) => Object.freeze({ ...source })) : []),
    extent: Object.freeze([
      Object.freeze([Math.min(...latitudes), Math.min(...longitudes)]),
      Object.freeze([Math.max(...latitudes), Math.max(...longitudes)]),
    ]),
    yearExtent: Object.freeze(yearValues.length
      ? [Math.min(...yearValues), Math.max(...yearValues)]
      : [null, null]),
  });
}

export async function loadAtlas(fetchImpl = globalThis.fetch, url = DEFAULT_DATA_URL) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response?.ok) throw new Error(`Atlas data request failed: ${response?.status ?? 'unknown'}`);
  return adaptRelease(await response.json());
}

export { DEFAULT_DATA_URL };
