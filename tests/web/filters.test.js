import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countActiveFilters,
  filterEntities,
  getFacetOptions,
} from '../../src/web/filters.js';
import { createSearchIndex, search } from '../../src/web/search.js';
import { discoveryEntities } from './domain-fixtures.js';

const emptyFacets = {
  entityClass: [],
  collection: [],
  country: [],
  ancientRegion: [],
  confidence: [],
  geometryRole: [],
};

test('facets compose with AND, values within a facet use OR, and dates use overlap', () => {
  const result = filterEntities(discoveryEntities(), {
    facets: {
      ...emptyFacets,
      entityClass: ['sanctuary'],
      country: ['GRC'],
    },
    years: { min: -500, max: -300 },
  });

  assert.deepEqual(result.map(({ id }) => id).sort(), ['delphi', 'epidaurus']);
});

test('search scores restrict and rank the filtered result', () => {
  const entities = discoveryEntities();
  const scores = search(createSearchIndex(entities), 'Apollo');
  const result = filterEntities(entities, {
    facets: { ...emptyFacets, entityClass: ['sanctuary'] },
    years: { min: -2000, max: 700 },
  }, scores, 'en');

  assert.deepEqual(result.map(({ id }) => id), ['delphi', 'didyma']);
});

test('contextual facet counts ignore their own active selections but apply other facets', () => {
  const filters = {
    facets: {
      ...emptyFacets,
      entityClass: ['sanctuary'],
      country: ['GRC'],
    },
    years: { min: -2000, max: 700 },
  };
  const options = getFacetOptions(discoveryEntities(), filters, 'country', 'el');

  assert.deepEqual(
    options.map(({ value, count, selected }) => ({ value, count, selected })),
    [
      { value: 'GRC', count: 2, selected: true },
      { value: 'TUR', count: 1, selected: false },
    ],
  );
});

test('active filter count includes selected values and a narrowed year range once', () => {
  assert.equal(countActiveFilters({
    facets: { ...emptyFacets, country: ['GRC', 'TUR'], confidence: ['medium'] },
    years: { min: -500, max: 300 },
    yearExtent: [-2000, 700],
  }), 4);
});
