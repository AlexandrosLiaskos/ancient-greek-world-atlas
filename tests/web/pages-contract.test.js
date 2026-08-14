import assert from 'node:assert/strict';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  collectLocalReferences,
  preparePages,
} from '../../scripts/prepare-pages.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function walkFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, path));
    else files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

test('the prepared Pages artifact is explicit, complete, and subpath-safe', async (context) => {
  const output = await mkdtemp(join(tmpdir(), 'agw-pages-'));
  context.after(() => rm(output, { recursive: true, force: true }));

  const copied = await preparePages(repoRoot, output);
  assert.deepEqual(copied, [
    'CITATION.cff',
    'LICENSE-CODE',
    'LICENSE-DATA',
    'README.md',
    'assets',
    'dist/ancient-greek-world.json',
    'index.html',
    'src/web',
  ]);

  assert.deepEqual((await readdir(output)).sort(), [
    'CITATION.cff',
    'LICENSE-CODE',
    'LICENSE-DATA',
    'README.md',
    'assets',
    'dist',
    'index.html',
    'src',
  ]);

  const references = await collectLocalReferences(join(output, 'index.html'));
  assert.ok(references.length >= 6);
  for (const reference of references) {
    assert.equal(reference.startsWith('/'), false, reference);
    assert.equal(reference.includes('..'), false, reference);
    await access(resolve(output, reference));
  }

  for (const required of [
    'assets/fonts/gfs-solomos.woff2',
    'dist/ancient-greek-world.json',
    'src/web/app.js',
    'src/web/data.js',
  ]) {
    await access(resolve(output, required));
  }
  assert.equal((await stat(resolve(output, 'dist/ancient-greek-world.json'))).size > 2_000_000, true);
});

test('the deployed frontend contains no secrets, backend configuration, or development payloads', async (context) => {
  const output = await mkdtemp(join(tmpdir(), 'agw-pages-safe-'));
  context.after(() => rm(output, { recursive: true, force: true }));
  await preparePages(repoRoot, output);

  const files = await walkFiles(output);
  assert.equal(files.some((path) => /(?:^|\/)node_modules(?:\/|$)/.test(path)), false);
  assert.equal(files.some((path) => /\.(?:sqlite|env|py|test\.js)$/i.test(path)), false);

  const frontendFiles = files.filter((path) => /\.(?:html|css|js)$/i.test(path));
  for (const path of frontendFiles) {
    const source = await readFile(resolve(output, path), 'utf8');
    assert.doesNotMatch(
      source,
      /supabase|service[_-]role|anon[_-]key|BEGIN (?:RSA |EC )?PRIVATE KEY/i,
      path,
    );
  }
});

test('the Pages workflow uses the prepared artifact and least-privilege deployment permissions', async () => {
  const workflow = await readFile(resolve(repoRoot, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /npm run prepare:pages/);
  assert.match(workflow, /path:\s*_site/);
  assert.doesNotMatch(workflow, /pull_request_target|contents:\s*write/);
});
