import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStatistics, periodForYear } from '../../src/web/statistics.js';
import { discoveryEntities, makeViewEntity } from './domain-fixtures.js';

test('period boundaries follow the atlas chronology contract', () => {
  assert.deepEqual(
    [-2000, -1100, -1099, -480, -479, -323, -322, -31, -30, 330, 331, 700]
      .map(periodForYear),
    ['bronze', 'bronze', 'archaic', 'archaic', 'classical', 'classical', 'hellenistic', 'hellenistic', 'roman', 'roman', 'lateAntique', 'lateAntique'],
  );
});

test('statistics expose exact accessible counts for the current entity set', () => {
  const stats = buildStatistics(discoveryEntities(), 'en');

  assert.deepEqual(
    stats.entityClass.map(({ value, label, count }) => ({ value, label, count })),
    [
      { value: 'settlement', label: 'Settlement', count: 1 },
      { value: 'sanctuary', label: 'Sanctuary', count: 3 },
      { value: 'polity', label: 'Polity', count: 1 },
    ],
  );
  assert.deepEqual(
    stats.country.map(({ value, count }) => ({ value, count })),
    [{ value: 'GRC', count: 4 }, { value: 'TUR', count: 1 }],
  );
  assert.equal(stats.total, 5);
  assert.equal(stats.entityClass[1].percentage, 60);
});

test('statistics are recalculated from a filtered subset rather than the full corpus', () => {
  const subset = [
    makeViewEntity({ id: 'p1', entityClass: 'polity', collections: ['kingdom'], startYear: -500 }),
    makeViewEntity({ id: 'p2', entityClass: 'polity', collections: ['kingdom'], startYear: -200 }),
  ];
  const stats = buildStatistics(subset, 'el');

  assert.deepEqual(stats.entityClass.map(({ value, count }) => [value, count]), [['polity', 2]]);
  assert.deepEqual(stats.period.map(({ value, count }) => [value, count]), [
    ['archaic', 1],
    ['hellenistic', 1],
  ]);
});

