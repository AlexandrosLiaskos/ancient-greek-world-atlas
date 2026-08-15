import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptRelease, loadAtlas } from '../../src/web/data.js';
import { makeRelease } from './fixtures.js';

test('adaptRelease resolves names, region, point semantics, chronology, and source scopes', () => {
  const atlas = adaptRelease(makeRelease());
  const [entity] = atlas.entities;

  assert.equal(entity.id, 'city-aegina-city');
  assert.deepEqual(entity.name, { el: 'Αίγινα', en: 'Aegina', grc: 'Αἴγινα' });
  assert.deepEqual(entity.collections, ['city', 'colony']);
  assert.deepEqual(entity.region, {
    id: 'region-saronikos',
    el: 'Σαρωνικός',
    en: 'Saronic Gulf',
  });
  assert.deepEqual(
    {
      latitude: entity.place.latitude,
      longitude: entity.place.longitude,
      geometryRole: entity.place.geometryRole,
      countryCode: entity.place.countryCode,
    },
    { latitude: 37.750149, longitude: 23.423668, geometryRole: 'site', countryCode: 'GRC' },
  );
  assert.deepEqual(atlas.extent, [[37.750149, 23.423668], [37.750149, 23.423668]]);
  assert.deepEqual(atlas.yearExtent, [-1000, 600]);
  assert.deepEqual(entity.sources[0].scopes, ['geometry', 'identity']);
  assert.equal(entity.relationships[0].targetEntityId, 'city-athens-attica');
  assert.deepEqual(entity.aliases.map(({ value }) => value), ['Αἴγινα', 'Aigina']);
  assert.equal(entity.media.length, 2);
  assert.deepEqual(
    {
      src: entity.media[0].src,
      alt: entity.media[0].alt,
      caption: entity.media[0].caption,
      license: entity.media[0].license,
    },
    {
      src: './assets/media/city-aegina-city/01.webp',
      alt: { el: 'Αίγινα: αρχαιολογική άποψη', en: 'Aegina: archaeological view' },
      caption: { el: 'Αίγινα · Αρχαιολογική άποψη', en: 'Aegina · Archaeological view' },
      license: 'CC BY-SA 4.0',
    },
  );
});

test('adaptRelease rejects duplicate ids and records without valid points', () => {
  const duplicate = makeRelease();
  duplicate.entities.push(structuredClone(duplicate.entities[0]));
  assert.throws(() => adaptRelease(duplicate), /duplicate entity id/i);

  const missingPoint = makeRelease();
  missingPoint.entities[0].places = [];
  assert.throws(() => adaptRelease(missingPoint), /usable point/i);
});

test('the checked-in public release adapts all 226 records and preserves its bounds', async () => {
  const payload = JSON.parse(
    await readFile(new URL('../../dist/ancient-greek-world.json', import.meta.url), 'utf8'),
  );
  const atlas = adaptRelease(payload);

  assert.equal(atlas.entities.length, 226);
  assert.equal(atlas.entitiesById.size, 226);
  assert.deepEqual(atlas.yearExtent, [-2000, 700]);
  assert.deepEqual(
    Object.fromEntries(
      ['settlement', 'sanctuary', 'polity'].map((kind) => [
        kind,
        atlas.entities.filter(({ entityClass }) => entityClass === kind).length,
      ]),
    ),
    { settlement: 119, sanctuary: 70, polity: 37 },
  );
});

test('loadAtlas requests the document-relative release and reports HTTP failures', async () => {
  const requested = [];
  const okAtlas = await loadAtlas(async (url, options) => {
    requested.push({ url, options });
    return { ok: true, json: async () => makeRelease() };
  });

  assert.equal(okAtlas.entities.length, 1);
  assert.deepEqual(requested, [{
    url: './dist/ancient-greek-world.json',
    options: { headers: { Accept: 'application/json' } },
  }]);

  await assert.rejects(
    loadAtlas(async () => ({ ok: false, status: 503 })),
    /atlas data request failed: 503/i,
  );
});
