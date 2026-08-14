import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSearchIndex,
  highlightRanges,
  normalizeSearchText,
  search,
} from '../../src/web/search.js';
import { discoveryEntities } from './domain-fixtures.js';

test('normalization removes Greek and Latin accents, normalizes sigma, and collapses punctuation', () => {
  assert.equal(normalizeSearchText('  Ἀθῆναι, ÁTHENS — Κνωσός  '), 'αθηναι athens κνωσοσ');
});

test('preferred-name matches rank above description-only matches', () => {
  const scores = search(createSearchIndex(discoveryEntities()), 'Αθηνα');

  assert.ok(scores.get('athens') > scores.get('delphi'));
  assert.deepEqual([...scores.keys()], ['athens', 'delphi']);
});

test('search finds ancient names, transliterations, localities, regions, and bilingual text', () => {
  const index = createSearchIndex(discoveryEntities());

  assert.ok(search(index, 'Athenae').has('athens'));
  assert.ok(search(index, 'Epidauros').has('epidaurus'));
  assert.ok(search(index, 'Didim').has('didyma'));
  assert.ok(search(index, 'Ιωνια').has('didyma'));
  assert.ok(search(index, 'oracular Apollo').has('didyma'));
});

test('every query token must match somewhere in the same entity', () => {
  const scores = search(createSearchIndex(discoveryEntities()), 'Apollo Phocis');

  assert.deepEqual([...scores.keys()], ['delphi']);
});

test('highlight ranges preserve offsets in accented display text', () => {
  assert.deepEqual(highlightRanges('Ἀθῆναι / Athens', 'Αθηναι'), [[0, 6]]);
  assert.deepEqual(highlightRanges('Δελφοί', 'athens'), []);
});
