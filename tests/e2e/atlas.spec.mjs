import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparePages } from '../../scripts/prepare-pages.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const transparentTile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lWcH0wAAAABJRU5ErkJggg==',
  'base64',
);

async function stabilizeMapTiles(page) {
  await page.route(/https:\/\/[^/]*(?:basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) => (
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentTile })
  ));
}

async function loadAtlas(page, url = '/?lang=el') {
  await stabilizeMapTiles(page);
  await page.goto(url);
  await expect(page.locator('#app')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#result-list [data-entity-id]')).toHaveCount(226);
}

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(`console: ${entry.text()}`);
  });
  return errors;
}

test.describe('desktop atlas', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop workflow');

  test('loads the prepared Pages artifact from a project subpath', async ({ page }) => {
    await preparePages(repoRoot, resolve(repoRoot, '_site'));
    await loadAtlas(page, '/_site/?lang=el');
    await expect(page.locator('html')).toHaveAttribute('lang', 'el');
    await expect(page.locator('#result-count')).toContainText('226');
  });

  test('loads Greek-first and preserves composed filters in the URL', async ({ page }) => {
    await loadAtlas(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'el');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Άτλας του Αρχαίου Ελληνικού Κόσμου');

    await page.getByRole('tab', { name: 'Φίλτρα', exact: true }).click();
    await page.getByRole('tab', { name: 'Σύγχρονη χώρα', exact: true }).click();
    const greece = page.getByRole('checkbox', { name: /Ελλάδα/ });
    await greece.check();
    await expect(page.locator('#result-count')).not.toHaveText('226 εγγραφές');
    await expect(page).toHaveURL(/country=GRC/);

    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-status', 'ready');
    await page.getByRole('tab', { name: 'Σύγχρονη χώρα', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Ελλάδα/ })).toBeChecked();
    await expect(page.getByRole('tab', { name: /^Φίλτρα/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('searches without Greek accents and switches the whole view to English', async ({ page }) => {
    await loadAtlas(page);
    await page.getByRole('tab', { name: 'Αναζήτηση', exact: true }).click();
    await page.getByLabel('Όνομα, τόπος ή λέξη').fill('Αθηναι');
    await expect(page.locator('#search-results')).toContainText('Αθήνα');
    const matchCount = await page.locator('#search-results [data-entity-id]').count();
    expect(matchCount).toBeGreaterThan(0);
    expect(matchCount).toBeLessThan(226);

    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Ancient Greek World Atlas');
    await expect(page.getByRole('tab', { name: 'Search', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Name, place, or word')).toHaveValue('Αθηναι');
    await expect(page).toHaveURL(/lang=en/);
  });

  test('uses count-only clusters and unnumbered class-shaped markers', async ({ page }) => {
    await loadAtlas(page);
    const clusters = page.locator('.atlas-cluster-count');
    await expect(clusters.first()).toBeVisible();
    const clusterTexts = await clusters.allTextContents();
    expect(clusterTexts.length).toBeGreaterThan(0);
    for (const text of clusterTexts) expect(text).toMatch(/^\d+$/);
    const markerTexts = await page.locator('.atlas-marker-core').allTextContents();
    expect(markerTexts.length).toBeGreaterThan(0);
    expect(markerTexts.every((text) => text === '')).toBe(true);
  });

  test('navigates scholarly relations and restores selection with Back and Forward', async ({ page }) => {
    await loadAtlas(page);
    const abydos = page.locator('#result-list').getByRole('button', { name: /^Άβυδος\./ });
    await abydos.click();
    const dialog = page.getByRole('dialog', { name: 'Άβυδος' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#record-close')).toBeFocused();
    await expect(page).toHaveURL(/entity=colony-abydos/);
    await expect(dialog.getByRole('heading', { name: 'Πηγές' })).toBeVisible();

    const related = dialog.locator('[data-related-entity]').first();
    await expect(related).toBeVisible();
    const relatedName = await related.textContent();
    await related.click();
    await expect(page.locator('#record-title')).toHaveText(relatedName.trim());

    await page.goBack();
    await expect(page.locator('#record-title')).toHaveText('Άβυδος');
    await page.goBack();
    await expect(dialog).toBeHidden();
    await page.goForward();
    await expect(page.getByRole('dialog', { name: 'Άβυδος' })).toBeVisible();
  });

  test('supports tab keyboard control and restores focus after closing a record', async ({ page }) => {
    await loadAtlas(page);
    const catalogueTab = page.getByRole('tab', { name: 'Κατάλογος', exact: true });
    await catalogueTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Φίλτρα', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(catalogueTab).toBeFocused();

    const trigger = page.locator('#result-list [data-entity-id]').first();
    await trigger.click();
    await page.locator('#record-close').click();
    await expect(page.locator('#record-dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('keeps catalogue and details usable when Leaflet is unavailable', async ({ page }) => {
    await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', (route) => (
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    ));
    await page.route('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js', (route) => (
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    ));
    await page.goto('/?lang=el');
    await expect(page.locator('#app')).toHaveAttribute('data-status', 'ready');
    await expect(page.locator('#result-list [data-entity-id]')).toHaveCount(226);
    await expect(page.locator('#map-error')).toContainText('χάρτης');
    await page.locator('#result-list [data-entity-id]').first().click();
    await expect(page.locator('#record-dialog')).toBeVisible();
  });

  test('has no runtime errors or broken ARIA references during the core flow', async ({ page }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    await loadAtlas(page);
    await page.getByRole('tab', { name: 'Στατιστικά', exact: true }).click();
    await expect(page.locator('#statistics-content button').first()).toBeVisible();
    const accessibilityProblems = await page.evaluate(() => {
      const problems = [];
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length) problems.push(`duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
      for (const element of document.querySelectorAll('[aria-labelledby], [aria-controls]')) {
        for (const id of `${element.getAttribute('aria-labelledby') ?? ''} ${element.getAttribute('aria-controls') ?? ''}`.trim().split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) problems.push(`missing aria reference: ${id}`);
        }
      }
      for (const button of document.querySelectorAll('button')) {
        const name = button.getAttribute('aria-label') || button.textContent?.trim();
        if (!name) problems.push('unnamed button');
      }
      return problems;
    });
    expect(accessibilityProblems).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });

  test('reflows at an effective 200 percent zoom without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await loadAtlas(page);
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
    await expect(page.locator('#mobile-actions')).toBeVisible();
  });
});

test.describe('mobile atlas', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile workflow');

  test('opens a tall independently scrollable catalogue sheet', async ({ page }) => {
    await loadAtlas(page);
    await expect(page.locator('#workbench')).toBeHidden();
    await page.locator('#mobile-actions').getByRole('button', { name: 'Κατάλογος', exact: true }).tap();
    await expect(page.locator('#workbench')).toBeVisible();
    await expect(page.locator('#tool-tabs')).toBeHidden();
    await expect(page.locator('#result-list [data-entity-id]')).toHaveCount(226);
    const dimensions = await page.locator('#panel-catalogue').evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
    await expect(page.locator('#mobile-actions')).toBeVisible();
  });

  test('has no horizontal overflow and opens records as full-screen sheets', async ({ page }) => {
    await loadAtlas(page);
    await page.locator('#mobile-actions').getByRole('button', { name: 'Κατάλογος', exact: true }).tap();
    await page.locator('#result-list [data-entity-id]').first().tap();
    const dialog = page.locator('#record-dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.width).toBeCloseTo(390, 0);
    expect(box.height).toBeCloseTo(844, 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('captures responsive visual evidence', async ({ page, isMobile }, testInfo) => {
  await loadAtlas(page);
  await page.evaluate(() => document.fonts.ready);
  if (isMobile) {
    await page.locator('#mobile-actions').getByRole('button', { name: 'Κατάλογος', exact: true }).tap();
    await page.screenshot({ path: testInfo.outputPath('atlas-mobile-catalogue.png'), animations: 'disabled' });
  } else {
    await page.screenshot({ path: testInfo.outputPath('atlas-desktop.png'), animations: 'disabled' });
    await page.locator('#result-list [data-entity-id]').first().click();
    await page.screenshot({ path: testInfo.outputPath('atlas-desktop-details.png'), animations: 'disabled' });
    await page.locator('#record-close').click();
    for (const [width, height] of [[1024, 768], [768, 1024]]) {
      await page.setViewportSize({ width, height });
      const [titleBox, actionsBox] = await Promise.all([
        page.locator('#masthead-title').boundingBox(),
        page.locator('.masthead-actions').boundingBox(),
      ]);
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(actionsBox.x);
      await page.screenshot({
        path: testInfo.outputPath(`atlas-${width}x${height}.png`),
        animations: 'disabled',
      });
    }
  }
});
