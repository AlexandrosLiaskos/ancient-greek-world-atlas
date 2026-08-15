PRAGMA foreign_keys = ON;

CREATE TABLE sources (
    source_id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    source_class TEXT NOT NULL CHECK (source_class IN ('scholarly_gazetteer','unesco','national_archaeological_service','museum','university','excavation_project','peer_reviewed_publication','reference_work','knowledge_graph','other')),
    language TEXT NOT NULL,
    license TEXT,
    accessed_on TEXT NOT NULL,
    http_status INTEGER,
    url_status TEXT NOT NULL CHECK (url_status IN ('ok','redirected','unavailable','unchecked')),
    citation TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE authorities (
    authority_id TEXT PRIMARY KEY,
    authority_type TEXT NOT NULL CHECK (authority_type IN ('ancient_region','deity_or_cult','dynasty','settlement','polity','geographic_region')),
    preferred_label_el TEXT NOT NULL,
    preferred_label_en TEXT NOT NULL,
    uri TEXT,
    source_id TEXT REFERENCES sources(source_id),
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded'))
);

CREATE TABLE entities (
    entity_id TEXT PRIMARY KEY,
    legacy_id TEXT NOT NULL UNIQUE,
    entity_class TEXT NOT NULL CHECK (entity_class IN ('settlement','sanctuary','polity')),
    entity_subtype TEXT NOT NULL,
    legacy_subtype TEXT,
    collections TEXT NOT NULL,
    preferred_name_el TEXT NOT NULL,
    preferred_name_en TEXT NOT NULL,
    ancient_name_grc TEXT,
    description_el TEXT NOT NULL,
    description_en TEXT NOT NULL,
    sanctuary_scope TEXT,
    sanctuary_setting TEXT,
    sanctuary_function_tags TEXT,
    ancient_region_authority_id TEXT NOT NULL REFERENCES authorities(authority_id),
    temporal_precision TEXT NOT NULL,
    location_certainty TEXT NOT NULL CHECK (location_certainty IN ('high','medium','low','disputed','unknown')),
    record_confidence TEXT NOT NULL CHECK (record_confidence IN ('high','medium','low','disputed','unknown')),
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded')),
    translation_status TEXT NOT NULL,
    data_version TEXT NOT NULL,
    source_origin TEXT NOT NULL,
    last_reviewed TEXT NOT NULL,
    reviewer TEXT NOT NULL
);

CREATE TABLE names (
    name_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    script TEXT NOT NULL,
    name_type TEXT NOT NULL CHECK (name_type IN ('preferred','ancient','modern','alternative','transliterated')),
    is_preferred INTEGER NOT NULL CHECK (is_preferred IN (0,1)),
    start_year INTEGER CHECK (start_year IS NULL OR start_year <> 0),
    end_year INTEGER CHECK (end_year IS NULL OR end_year <> 0),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded')),
    CHECK (start_year IS NULL OR end_year IS NULL OR start_year <= end_year),
    UNIQUE (entity_id, language, name_type, name)
);

CREATE TABLE places (
    place_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    geometry_wkt TEXT NOT NULL,
    geometry_geojson TEXT NOT NULL,
    geometry_role TEXT NOT NULL CHECK (geometry_role IN ('site','proxy','representative_center')),
    location_certainty TEXT NOT NULL CHECK (location_certainty IN ('high','medium','low','disputed','unknown')),
    location_precision TEXT NOT NULL,
    modern_country_el TEXT NOT NULL,
    modern_country_en TEXT NOT NULL,
    country_iso3 TEXT NOT NULL CHECK (length(country_iso3) = 3),
    country_iso2 TEXT NOT NULL CHECK (length(country_iso2) = 2),
    modern_locality TEXT,
    coordinate_source_text TEXT NOT NULL,
    spatial_note_el TEXT,
    spatial_note_en TEXT,
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded'))
);

CREATE TABLE chronologies (
    chronology_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    start_year INTEGER NOT NULL CHECK (start_year <> 0),
    end_year INTEGER NOT NULL CHECK (end_year <> 0),
    start_precision TEXT NOT NULL,
    end_precision TEXT NOT NULL,
    temporal_precision TEXT NOT NULL,
    chronology_basis TEXT NOT NULL CHECK (chronology_basis IN ('occupation_window','cult_activity_window','political_phase','foundation','construction_phase','use_phase','unknown')),
    display_cutoff INTEGER NOT NULL CHECK (display_cutoff IN (0,1)),
    label_el TEXT NOT NULL,
    label_en TEXT NOT NULL,
    note_el TEXT,
    note_en TEXT,
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded')),
    CHECK (start_year <= end_year)
);

CREATE TABLE relationships (
    relationship_id TEXT PRIMARY KEY,
    subject_entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    predicate TEXT NOT NULL CHECK (predicate IN ('founded_from','associated_with_settlement','representative_center','preceded_by','succeeded_by','cult_of','ruled_by_dynasty','part_of')),
    object_entity_id TEXT REFERENCES entities(entity_id),
    object_authority_id TEXT REFERENCES authorities(authority_id),
    object_label_el TEXT NOT NULL,
    object_label_en TEXT NOT NULL,
    certainty TEXT NOT NULL CHECK (certainty IN ('high','medium','low','disputed','unknown')),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    migration_evidence_el TEXT,
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded')),
    CHECK ((object_entity_id IS NOT NULL) <> (object_authority_id IS NOT NULL)),
    UNIQUE (subject_entity_id, predicate, object_entity_id, object_authority_id, object_label_el)
);

CREATE TABLE entity_sources (
    entity_source_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
    support_scope TEXT NOT NULL CHECK (support_scope IN ('identity','names','description','chronology','geometry','classification','relationships')),
    is_primary INTEGER NOT NULL CHECK (is_primary IN (0,1)),
    UNIQUE (entity_id, source_id, support_scope)
);

CREATE TABLE external_ids (
    external_id TEXT PRIMARY KEY,
    entity_id TEXT REFERENCES entities(entity_id) ON DELETE CASCADE,
    place_id TEXT REFERENCES places(place_id) ON DELETE CASCADE,
    scheme TEXT NOT NULL,
    identifier TEXT NOT NULL,
    uri TEXT NOT NULL,
    match_type TEXT NOT NULL CHECK (match_type IN ('exact','close','representative_center','source_record')),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    CHECK ((entity_id IS NOT NULL) <> (place_id IS NOT NULL)),
    UNIQUE (scheme, identifier, entity_id, place_id)
);

CREATE TABLE media (
    media_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
    role TEXT NOT NULL CHECK (role IN ('primary','gallery')),
    file_path TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    original_url TEXT NOT NULL,
    title TEXT NOT NULL,
    creator TEXT NOT NULL,
    license TEXT NOT NULL,
    license_url TEXT NOT NULL,
    attribution TEXT NOT NULL,
    caption_el TEXT NOT NULL,
    caption_en TEXT NOT NULL,
    alt_el TEXT NOT NULL,
    alt_en TEXT NOT NULL,
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
    retrieved_on TEXT NOT NULL,
    review_state TEXT NOT NULL CHECK (review_state IN ('draft','needs_review','machine_checked','reviewed','verified','excluded')),
    CHECK ((position = 1 AND role = 'primary') OR (position > 1 AND role = 'gallery')),
    UNIQUE (entity_id, position)
);

CREATE INDEX idx_entities_class ON entities(entity_class);
CREATE INDEX idx_entities_review_state ON entities(review_state);
CREATE INDEX idx_places_entity ON places(entity_id);
CREATE INDEX idx_chronologies_entity ON chronologies(entity_id);
CREATE INDEX idx_relationships_subject ON relationships(subject_entity_id);
CREATE INDEX idx_relationships_object_entity ON relationships(object_entity_id);
CREATE INDEX idx_entity_sources_entity ON entity_sources(entity_id);
CREATE INDEX idx_external_ids_entity ON external_ids(entity_id);
CREATE INDEX idx_media_entity ON media(entity_id);

CREATE VIEW entity_overview AS
SELECT
    e.entity_id,
    e.preferred_name_el,
    e.preferred_name_en,
    e.entity_class,
    e.entity_subtype,
    e.collections,
    p.longitude,
    p.latitude,
    p.geometry_role,
    c.start_year,
    c.end_year,
    e.review_state
FROM entities e
LEFT JOIN places p ON p.entity_id = e.entity_id
LEFT JOIN chronologies c ON c.entity_id = e.entity_id;
