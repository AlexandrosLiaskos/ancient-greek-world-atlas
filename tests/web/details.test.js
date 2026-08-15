import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptRelease } from '../../src/web/data.js';
import { makeRelease } from './fixtures.js';
import { installDOM } from './dom-fixture.js';

test('details keep chronology qualifiers, spatial role, and source scopes', async () => {
  const { buildDetailsModel } = await import('../../src/web/details.js');
  const atlas = adaptRelease(makeRelease());
  const details = buildDetailsModel(atlas.entities[0], atlas, 'en');

  assert.match(details.chronologies[0].label, /BCE/);
  assert.equal(details.chronologies[0].startPrecision, 'Approximate');
  assert.equal(details.place.geometryRole, 'Site');
  assert.equal(details.place.coordinateText, '37.750149, 23.423668');
  assert.ok(details.sourceGroups.some((group) => group.scopes.includes('geometry')));
  assert.equal(details.editorial.lastReviewed, '2026-08-14');
  assert.equal(details.media.length, 2);
  assert.equal(details.media[0].alt, 'Aegina: archaeological view');
  assert.equal(details.media[0].caption, 'Aegina · Archaeological view');
});

test('internal relationships navigate by entity id and authorities stay text', async () => {
  const { buildDetailsModel } = await import('../../src/web/details.js');
  const release = makeRelease();
  const sourceEntity = release.entities[0];
  const targetEntity = structuredClone(sourceEntity);
  targetEntity.entity_id = 'city-athens-attica';
  targetEntity.preferred_name_el = 'Αθήνα';
  targetEntity.preferred_name_en = 'Athens';
  targetEntity.places[0].entity_id = targetEntity.entity_id;
  targetEntity.places[0].place_id = 'place-city-athens-attica';
  targetEntity.places[0].latitude = 37.9838;
  targetEntity.places[0].longitude = 23.7275;
  targetEntity.places[0].geometry_geojson.coordinates = [23.7275, 37.9838];
  targetEntity.relationships = [];
  targetEntity.names = targetEntity.names.map((name) => ({ ...name, entity_id: targetEntity.entity_id }));
  targetEntity.chronologies = targetEntity.chronologies.map((chronology) => ({ ...chronology, entity_id: targetEntity.entity_id }));
  const authorityRelation = {
    ...sourceEntity.relationships[0],
    relationship_id: 'rel-aegina-region',
    object_entity_id: null,
    object_authority_id: 'region-saronikos',
    object_label_el: 'Σαρωνικός',
    object_label_en: 'Saronic Gulf',
  };
  sourceEntity.relationships.push(authorityRelation);
  const atlas = adaptRelease({ ...release, entities: [sourceEntity, targetEntity] });
  const details = buildDetailsModel(atlas.entitiesById.get(sourceEntity.entity_id), atlas, 'el');

  assert.equal(details.relationships[0].targetEntityId, 'city-athens-attica');
  assert.equal(details.relationships[0].target, 'Αθήνα');
  assert.equal(details.relationships[1].targetEntityId, null);
  assert.equal(details.relationships[1].target, 'Σαρωνικός');
});

test('duplicate source support is grouped without losing claim scopes', async () => {
  const { groupSources } = await import('../../src/web/details.js');
  const repeatedSources = [
    { id: 'src-1', title: 'Gazetteer', url: 'https://example.test/1', scopes: ['identity'] },
    { id: 'src-1', title: 'Gazetteer', url: 'https://example.test/1', scopes: ['geometry', 'identity'] },
  ];
  const groups = groupSources(repeatedSources);

  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].scopes].sort(), ['geometry', 'identity']);
});

test('detail renderer uses safe text, external-link protection, and relation buttons', async () => {
  const { buildDetailsModel, renderDetails } = await import('../../src/web/details.js');
  const document = installDOM();
  const release = makeRelease();
  const target = structuredClone(release.entities[0]);
  target.entity_id = 'city-athens-attica';
  target.preferred_name_el = 'Αθήνα';
  target.preferred_name_en = 'Athens';
  target.relationships = [];
  target.places[0].entity_id = target.entity_id;
  target.places[0].place_id = 'place-city-athens-attica';
  target.places[0].latitude = 37.9838;
  target.places[0].longitude = 23.7275;
  target.places[0].geometry_geojson.coordinates = [23.7275, 37.9838];
  const atlas = adaptRelease({ ...release, entities: [release.entities[0], target] });
  const model = buildDetailsModel(atlas.entities[0], atlas, 'en');
  const dialog = document.createElement('dialog');
  const title = document.createElement('h2');
  title.id = 'record-title';
  const content = document.createElement('div');
  content.id = 'record-content';
  dialog.append(title, content);
  const navigated = [];

  renderDetails(dialog, model, { onNavigateEntity: (id) => navigated.push(id) });

  assert.equal(title.textContent, 'Aegina');
  const images = content.querySelectorAll('.media-image');
  assert.equal(images.length, 2);
  assert.equal(images[0].getAttribute('src'), './assets/media/city-aegina-city/01.webp');
  assert.equal(images[0].getAttribute('alt'), 'Aegina: archaeological view');
  assert.equal(images[0].getAttribute('loading'), 'eager');
  assert.equal(images[1].getAttribute('loading'), 'lazy');
  assert.equal(content.querySelectorAll('.media-thumbnail').length, 2);
  const thumbnailImages = content.querySelectorAll('.media-thumbnail-image');
  assert.equal(thumbnailImages.length, 2);
  assert.equal(thumbnailImages[0].getAttribute('src'), './assets/media/city-aegina-city/01.webp');
  assert.equal(thumbnailImages[0].getAttribute('alt'), '');
  assert.match(content.querySelector('.media-attribution').textContent, /Example Photographer/);
  assert.equal(content.querySelector('.record-media').getAttribute('aria-label'), 'Images of Aegina');
  const relation = content.querySelector('[data-related-entity]');
  relation.dispatchEvent({ type: 'click' });
  assert.deepEqual(navigated, ['city-athens-attica']);
  const externalLinks = content.querySelectorAll('a');
  assert.ok(externalLinks.length >= 1);
  for (const link of externalLinks) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
});
