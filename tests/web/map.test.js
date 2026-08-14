import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptRelease } from '../../src/web/data.js';
import { makeRelease } from './fixtures.js';

test('individual marker descriptors classify without ordinal text', async () => {
  const { markerDescriptor } = await import('../../src/web/map.js');
  const settlement = adaptRelease(makeRelease()).entities[0];
  const marker = markerDescriptor(settlement, 'el');

  assert.equal(marker.shape, 'circle');
  assert.equal(marker.text, '');
  assert.equal(marker.entityClass, 'settlement');
  assert.match(marker.ariaLabel, /Οικισμός/);
  assert.doesNotMatch(marker.ariaLabel, /\b1\b/);
});

test('cluster descriptors contain only their member count', async () => {
  const { clusterDescriptor } = await import('../../src/web/map.js');
  assert.deepEqual(clusterDescriptor(17), {
    count: 17,
    size: 'medium',
    ariaLabel: '17 records',
  });
});

test('representative centres retain an explicit uncertainty modifier', async () => {
  const { markerDescriptor } = await import('../../src/web/map.js');
  const source = adaptRelease(makeRelease()).entities[0];
  const polity = {
    ...source,
    entityClass: 'polity',
    place: { ...source.place, geometryRole: 'representative_center' },
  };
  const marker = markerDescriptor(polity, 'en');

  assert.equal(marker.shape, 'square');
  assert.equal(marker.spatialRole, 'representative_center');
  assert.match(marker.className, /is-representative/);
  assert.match(marker.ariaLabel, /Representative centre/);
});

test('marker descriptors keep proxy coordinates distinct from representative centres', async () => {
  const { markerDescriptor } = await import('../../src/web/map.js');
  const source = adaptRelease(makeRelease()).entities[0];
  const sanctuary = {
    ...source,
    entityClass: 'sanctuary',
    place: { ...source.place, geometryRole: 'proxy' },
  };
  const marker = markerDescriptor(sanctuary, 'el');

  assert.equal(marker.shape, 'diamond');
  assert.match(marker.className, /is-proxy/);
  assert.doesNotMatch(marker.className, /is-representative/);
});

