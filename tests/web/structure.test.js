import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../../index.html', import.meta.url);

test('the page exposes every mount point required by the atlas', async () => {
  const html = await readFile(htmlPath, 'utf8');

  for (const id of [
    'app',
    'masthead-title',
    'language-toggle',
    'about-button',
    'workbench',
    'tool-tabs',
    'panel-catalogue',
    'panel-filters',
    'panel-search',
    'panel-statistics',
    'result-list',
    'map',
    'map-legend',
    'map-status',
    'mobile-actions',
    'record-dialog',
    'about-dialog',
    'app-status',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), id);
  }
});

test('the page uses document-relative runtime paths for GitHub Pages', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.doesNotMatch(html, /(?:src|href)=["']\/(?!\/)/);
  assert.match(html, /src=["']\.\/src\/web\/app\.js["']/);
  assert.match(html, /data-source=["']\.\/dist\/ancient-greek-world\.json["']/);
});

test('the catalogue is the initially selected workbench tab', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.match(
    html,
    /id=["']tab-catalogue["'][^>]*aria-selected=["']true["'][^>]*tabindex=["']0["']/,
  );
  assert.match(html, /id=["']panel-catalogue["'][^>]*role=["']tabpanel["']/);
});

