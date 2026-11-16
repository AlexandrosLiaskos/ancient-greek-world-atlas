import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VISITS_ENDPOINT,
  VISITS_STORAGE_KEY,
  renderVisits,
  startVisits,
} from '../../src/web/visits.js';

function fakeDocument(lang = 'el') {
  const elements = new Map(
    ['about-visits-label', 'about-visits-count', 'about-visits-note'].map((id) => [id, { id, textContent: '—' }]),
  );
  return {
    documentElement: { lang },
    getElementById: (id) => elements.get(id) ?? null,
    text: (id) => elements.get(id).textContent,
  };
}

function fakeWindow({ counted = false, status = 200, payload = { count: 1234 }, fail = false } = {}) {
  const stored = new Map(counted ? [[VISITS_STORAGE_KEY, 'yes']] : []);
  const requests = [];
  return {
    requests,
    stored,
    sessionStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (fail) throw new Error('network');
      return { ok: status >= 200 && status < 300, status, json: async () => payload };
    },
  };
}

test('a failed or invalid answer leaves the page unchanged and does not mark the session', async () => {
  for (const options of [{ fail: true }, { status: 429 }, { payload: { count: -1 } }, { payload: {} }]) {
    const document = fakeDocument('el');
    const window = fakeWindow(options);

    assert.equal(await startVisits(document, window), null);
    assert.equal(document.text('about-visits-count'), '—');
    assert.equal(window.stored.has(VISITS_STORAGE_KEY), false);
  }
});

test('nothing is requested when the page has no place for the number', async () => {
  const window = fakeWindow();
  assert.equal(await startVisits({ getElementById: () => null }, window), null);
  assert.equal(window.requests.length, 0);
});

test('the first request of a browser session records the visit and later requests only read', async () => {
  const document = fakeDocument('en');
  const window = fakeWindow();

  assert.equal(await startVisits(document, window), 1234);
  assert.equal(window.requests[0].url, VISITS_ENDPOINT);
  assert.equal(window.requests[0].method, 'POST');
  assert.equal(window.requests[0].credentials, 'omit');
  assert.equal(window.stored.get(VISITS_STORAGE_KEY), 'yes');
  assert.equal(document.text('about-visits-count'), '1,234');

  await startVisits(document, window);
  assert.equal(window.requests[1].method, 'GET');
});

test('the label, the note and the number follow the language', async () => {
  const document = fakeDocument('el');
  await startVisits(document, fakeWindow({ counted: true, payload: { count: 1234 } }));

  assert.equal(document.text('about-visits-count'), '1.234');
  assert.equal(document.text('about-visits-label'), 'Καταγεγραμμένες επισκέψεις σελίδας');
  renderVisits(document, 'en');
  assert.equal(document.text('about-visits-label'), 'Recorded page visits');
  assert.equal(document.text('about-visits-count'), '1,234');
  assert.match(document.text('about-visits-note'), /does not use cookies/);
});
