/**
 * Builds a single, fully self-contained MarkEdit extension script.
 *
 * MarkEdit extensions are plain .js files injected into the editor WebView;
 * there is no manifest, no bundler and no network access at runtime. All source
 * parts therefore share one IIFE scope and are simply concatenated, with the
 * stylesheet embedded as a string literal.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const minAppVersion = '1.37.0';

const parts = [
  'src/01-core.js',
  'src/02-fs.js',
  'src/03-ui.js',
  'src/04-ops.js',
  'src/05-boot.js',
];

const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const sources = parts.map((file) => {
  const text = readFileSync(join(root, file), 'utf8');
  return `/* ---- ${file} ---- */\n${text.trim()}\n`;
});

const header = `/**
 * MarkEdit Explorer v${version}
 * A VS Code / Codex style file explorer sidebar for MarkEdit.
 *
 * id:             markedit-explorer
 * version:        ${version}
 * minAppVersion:  ${minAppVersion}
 * format:         single injectable script (MarkEdit official extension format)
 * runtime:        offline, no CDN, no external dependencies, no main-app patches
 *
 * Install:  place this file at
 *   ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/markedit-explorer.js
 * and register it in extensions.json (see install.sh), then relaunch MarkEdit.
 */
`;

const bundle =
  header +
  '(function () {\n' +
  '"use strict";\n\n' +
  `const CSS_TEXT = ${JSON.stringify(css)};\n\n` +
  sources.join('\n') +
  '\n})();\n';

const output = bundle
  .replaceAll('__VERSION__', version)
  .replaceAll('__MIN_APP_VERSION__', minAppVersion);

mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'registry'), { recursive: true });
const distPath = join(root, 'dist', 'markedit-explorer.js');
writeFileSync(distPath, output, 'utf8');

const sha256 = createHash('sha256').update(output, 'utf8').digest('hex');

const registry = {
  $schema:
    'https://github.com/MarkEdit-app/extensions/raw/refs/heads/main/schemas/extension.schema.json',
  id: 'markedit-explorer',
  name: 'MarkEdit Explorer',
  description:
    'A VS Code / Codex style file explorer sidebar: multi-root workspaces, file management, remembered state and auto refresh.',
  author: 'NickBi1',
  homepage: 'https://github.com/NickBi1/markedit-explorer',
  versions: [
    {
      version,
      url: `https://github.com/NickBi1/markedit-explorer/releases/download/v${version}/markedit-explorer.js`,
      sha256,
      minAppVersion,
      notes: 'Initial release: file tree, file operations, workspace memory and auto refresh.',
    },
  ],
};
writeFileSync(
  join(root, 'registry', 'markedit-explorer.json'),
  JSON.stringify(registry, null, 2) + '\n',
  'utf8',
);

console.log(`built  dist/markedit-explorer.js  (${Buffer.byteLength(output)} bytes)`);
console.log(`sha256 ${sha256}`);
console.log('built  registry/markedit-explorer.json');
