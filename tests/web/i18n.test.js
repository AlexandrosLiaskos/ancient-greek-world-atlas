import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCoordinates,
  formatDateRange,
  formatYear,
  localeFor,
  localized,
  message,
  vocabularyLabel,
} from '../../src/web/i18n.js';

test('year formatting localizes BCE and CE and rejects year zero', () => {
  assert.equal(formatYear(-447, 'el'), '447 π.Χ.');
  assert.equal(formatYear(-447, 'en'), '447 BCE');
  assert.equal(formatYear(161, 'el'), '161 μ.Χ.');
  assert.equal(formatYear(161, 'en'), '161 CE');
  assert.throws(() => formatYear(0, 'el'), /year zero/i);
});

test('date ranges prefer the reviewed localized label and otherwise format signed years', () => {
  assert.equal(
    formatDateRange({ label: { el: 'περ. 500–400 π.Χ.', en: 'c. 500–400 BCE' } }, 'el'),
    'περ. 500–400 π.Χ.',
  );
  assert.equal(
    formatDateRange({ startYear: -323, endYear: 31, label: { el: '', en: '' } }, 'en'),
    '323 BCE–31 CE',
  );
});

test('localized values fall back to the other public language without returning blanks', () => {
  assert.equal(localized({ el: '', en: 'Athens' }, 'el'), 'Athens');
  assert.equal(localized({ el: 'Αθήνα', en: '' }, 'en'), 'Αθήνα');
  assert.equal(localized(null, 'el'), '');
});

test('messages interpolate localized counts and reject unknown keys', () => {
  assert.equal(message('el', 'resultCount', { count: 226 }), '226 εγγραφές');
  assert.equal(message('en', 'resultCount', { count: 1 }), '1 record');
  assert.throws(() => message('el', 'missingKey'), /unknown message/i);
});

test('controlled vocabulary and coordinates are bilingual', () => {
  assert.equal(vocabularyLabel('entityClass', 'sanctuary', 'el'), 'Ιερό');
  assert.equal(vocabularyLabel('geometryRole', 'representative_center', 'en'), 'Representative centre');
  assert.equal(formatCoordinates(37.9838, 23.7275, 'el'), '37,9838° Β · 23,7275° Α');
  assert.equal(formatCoordinates(37.9838, 23.7275, 'en'), '37.9838° N · 23.7275° E');
  assert.equal(localeFor('el'), 'el-GR');
  assert.equal(localeFor('en'), 'en-GB');
});

