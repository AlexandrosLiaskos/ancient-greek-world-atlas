import { localeFor, message } from './i18n.js';

export const VISITS_ENDPOINT = 'https://evelpidou.nkua.cloud/api/visits/ancient-greek-world-atlas';
export const VISITS_STORAGE_KEY = 'ancient-greek-world-atlas-visit-counted-v1';
const PLACEHOLDER = '—';

let recordedVisits = null;

function byId(document, id) {
  return document.getElementById?.(id) ?? document.querySelector?.(`#${id}`) ?? null;
}

function setText(document, id, value) {
  const element = byId(document, id);
  if (element) element.textContent = value;
}

/**
 * Write the label, the note and the number of recorded page visits in the given language.
 * The placeholder is shown until the counter has answered.
 */
export function renderVisits(document, lang) {
  setText(document, 'about-visits-label', message(lang, 'visitsLabel'));
  setText(document, 'about-visits-note', message(lang, 'visitsNote'));
  setText(
    document,
    'about-visits-count',
    recordedVisits === null ? PLACEHOLDER : recordedVisits.toLocaleString(localeFor(lang)),
  );
}

/**
 * Ask the visit counter for the total of recorded page visits and show it.
 * A browser session is counted once: its first request records the visit (POST),
 * later requests only read the total (GET). The counter uses no cookies and stores
 * only the total. When it cannot be reached the placeholder stays.
 */
export async function startVisits(document, window) {
  if (!byId(document, 'about-visits-count') || typeof window?.fetch !== 'function') return null;

  let counted = false;
  try {
    counted = window.sessionStorage.getItem(VISITS_STORAGE_KEY) === 'yes';
  } catch {
    counted = false;
  }

  try {
    const response = await window.fetch(VISITS_ENDPOINT, {
      method: counted ? 'GET' : 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const total = Number(payload.count);
    if (!Number.isFinite(total) || total < 0) throw new Error('Invalid visit count');
    recordedVisits = total;
    if (!counted) {
      try {
        window.sessionStorage.setItem(VISITS_STORAGE_KEY, 'yes');
      } catch {
        // The counter still works when browser storage is unavailable.
      }
    }
  } catch {
    return null;
  }

  renderVisits(document, document.documentElement?.lang === 'en' ? 'en' : 'el');
  return recordedVisits;
}
