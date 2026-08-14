import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptRelease } from '../../src/web/data.js';
import { makeRelease } from './fixtures.js';

test('catalogue rows expose localized place, date, class, and uncertainty', async () => {
  const { buildCatalogueRows } = await import('../../src/web/catalogue.js');
  const entity = adaptRelease(makeRelease()).entities[0];
  const [row] = buildCatalogueRows([entity], 'el', 'Αιγινα');

  assert.equal(row.title, 'Αίγινα');
  assert.equal(row.ancientName, 'Αἴγινα');
  assert.equal(row.location, 'Αίγινα · Ελλάδα');
  assert.equal(row.classLabel, 'Οικισμός');
  assert.equal(row.geometryRole, 'site');
  assert.equal(row.uncertain, false);
  assert.match(row.date, /π\.Χ\./);
  assert.deepEqual(row.titleMatches, [[0, 6]]);
});

test('catalogue rows flag proxy and representative coordinates without ordinal text', async () => {
  const { buildCatalogueRows } = await import('../../src/web/catalogue.js');
  const model = adaptRelease(makeRelease());
  const entity = {
    ...model.entities[0],
    entityClass: 'polity',
    place: { ...model.entities[0].place, geometryRole: 'representative_center' },
  };
  const [row] = buildCatalogueRows([entity], 'en', '');

  assert.equal(row.classLabel, 'Polity');
  assert.equal(row.geometryRoleLabel, 'Representative centre');
  assert.equal(row.uncertain, true);
  assert.equal('ordinal' in row, false);
});

test('catalogue renderer uses buttons, safe text, and preview/detail handlers', async () => {
  const { installDOM } = await import('./dom-fixture.js');
  const document = installDOM();
  const { renderCatalogue } = await import('../../src/web/catalogue.js');
  const entity = adaptRelease(makeRelease()).entities[0];
  const root = document.createElement('ul');
  const events = [];

  renderCatalogue(root, {
    entities: [entity],
    lang: 'el',
    query: '',
    selectedEntityId: entity.id,
  }, {
    onPreview: (id) => events.push(['preview', id]),
    onLeavePreview: (id) => events.push(['leave', id]),
    onOpenDetails: (id) => events.push(['open', id]),
  });

  const button = root.querySelector('[data-entity-id]');
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.dataset.entityId, entity.id);
  assert.equal(button.getAttribute('aria-current'), 'true');
  assert.match(button.getAttribute('aria-label'), /Αίγινα/);
  assert.equal(root.querySelector('h3').textContent, 'Αίγινα');

  button.dispatchEvent({ type: 'pointerenter' });
  button.dispatchEvent({ type: 'focus' });
  button.dispatchEvent({ type: 'pointerleave' });
  button.dispatchEvent({ type: 'click' });
  assert.deepEqual(events, [
    ['preview', entity.id],
    ['preview', entity.id],
    ['leave', entity.id],
    ['open', entity.id],
  ]);
});

