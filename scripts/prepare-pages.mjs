import {
  cp,
  mkdir,
  readFile,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE_ENTRIES = Object.freeze([
  'CITATION.cff',
  'LICENSE-CODE',
  'LICENSE-DATA',
  'README.md',
  'THIRD_PARTY_MEDIA.md',
  'assets',
  'dist/ancient-greek-world.json',
  'index.html',
  'src/web',
]);

function normalizedRelative(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function safeDestination(root, destination) {
  const sourceRoot = resolve(root);
  const output = resolve(destination);
  if (output === sourceRoot || output === parse(output).root) {
    throw new Error(`Refusing unsafe Pages destination: ${output}`);
  }
  return { sourceRoot, output };
}

export async function preparePages(root, destination) {
  const { sourceRoot, output } = safeDestination(root, destination);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  for (const entry of PAGE_ENTRIES) {
    const source = resolve(sourceRoot, entry);
    const target = resolve(output, entry);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, force: true });
  }
  return [...PAGE_ENTRIES];
}

function isLocalReference(reference) {
  const value = reference.trim();
  return value
    && !value.startsWith('#')
    && !value.startsWith('//')
    && !/^[a-z][a-z\d+.-]*:/i.test(value)
    && !isAbsolute(value);
}

export async function collectLocalReferences(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const references = new Set();
  const attributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/giu;
  for (const match of html.matchAll(attributePattern)) {
    const raw = match[2].trim();
    if (!isLocalReference(raw)) continue;
    const clean = raw.split('#', 1)[0].split('?', 1)[0];
    if (!clean) continue;
    references.add(normalizedRelative(relative(dirname(htmlPath), resolve(dirname(htmlPath), clean))));
  }
  return [...references].sort();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const output = resolve(root, '_site');
  const copied = await preparePages(root, output);
  process.stdout.write(`Prepared ${copied.length} Pages entries in ${output}\n`);
}
