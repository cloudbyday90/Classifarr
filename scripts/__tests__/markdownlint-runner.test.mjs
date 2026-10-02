/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readLintConfiguration, selectMarkdownFiles } from '../markdownlint/files.mjs';
import { matchesPattern, validatePatterns } from '../markdownlint/patterns.mjs';
import { runMarkdownLint } from '../markdownlint/run.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configuration = readLintConfiguration(root);

function fixture(context) {
  const directory = mkdtempSync(resolve(tmpdir(), 'classifarr-markdown-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, content = '# Title\n') => {
    mkdirSync(dirname(resolve(directory, path)), { recursive: true });
    writeFileSync(resolve(directory, path), content);
  };
  put('.markdownlint-repo.json', JSON.stringify({ globs: configuration.globs, ignores: configuration.ignores }));
  put('.markdownlint.json', JSON.stringify(configuration.config));
  return { directory, put };
}

test('selection preserves case, dotfiles, shallow roots, exclusions and deduplication', context => {
  const { directory, put } = fixture(context);
  const expected = ['.notes.md', 'BACKUP_IMPLEMENTATION.md', 'README.md',
    'docs/.hidden/guide.md', 'docs/guide.md', 'docs/sub/guide.md'];
  for (const path of [...expected, 'docs/backup.md', 'docs/x_backup_old.md',
    'docs/node_modules/guide.md', 'data/private.md', 'client/unselected.md', 'docs/upper.MD']) put(path);
  assert.deepEqual(selectMarkdownFiles(directory, configuration, ['docs/guide.md']), expected.sort());
  assert.throws(() => selectMarkdownFiles(directory, configuration, ['DATA/*.md']), /No eligible/);
  assert.throws(() => selectMarkdownFiles(directory, configuration, ['DOCS/*.md']), /No eligible/);
});

test('POSIX filenames containing wildcard characters remain linted', context => {
  const { directory, put } = fixture(context);
  put('README.md');
  if (process.platform !== 'win32') {
    put('docs/*guide.md');
    assert.deepEqual(selectMarkdownFiles(directory, configuration), ['README.md', 'docs/*guide.md']);
  } else {
    // Windows forbids * in filenames; exercise the same matcher without I/O.
    assert.equal(matchesPattern('docs/**/*.md', 'docs/*guide.md'), true);
  }
});

test('file discovery never follows directory links or an explicit linked prefix', context => {
  const { directory, put } = fixture(context);
  put('README.md');
  put('data/private.md');
  mkdirSync(resolve(directory, 'docs'));
  symlinkSync(resolve(directory, 'data'), resolve(directory, 'docs/linked'), 'junction');
  assert.deepEqual(selectMarkdownFiles(directory, configuration), ['README.md']);
  assert.throws(() => selectMarkdownFiles(directory, configuration, ['docs/linked/*.md']), /No eligible/);
});

test('simple wildcard matching is case-sensitive and supports zero-segment globstars', () => {
  for (const [pattern, path, expected] of [
    ['**/*.md', 'a.md', true], ['docs/**/*.md', 'docs/a.md', true],
    ['docs/**/*.md', 'docs/a/b.md', true], ['*.md', 'docs/a.md', false],
    ['**/*backup*.md', 'BACKUP.md', false], ['docs/?.md', 'docs/a.md', true],
    ['docs/?.md', 'docs/ab.md', false], ['**/node_modules/**', 'docs/node_modules', true],
    ['a*b*c', 'aaabbbc', true], ['a*b*c', 'aaabbbd', false],
    ['*.md', '*guide.md', true], ['docs/**/*.md', 'docs/*guide.md', true],
  ]) assert.equal(matchesPattern(pattern, path), expected, `${pattern}: ${path}`);
});

test('nested braces, alternate extglobs, parent paths and CLI options fail before discovery', context => {
  const { directory } = fixture(context);
  for (const pattern of ['{'.repeat(4998) + 'a,b' + '}'.repeat(4998),
    '{docs,database}/**/*.md', '('.repeat(4000), 'docs/@(a|b).md',
    '../outside.md', '/outside.md', 'C:/outside.md', 'docs\\guide.md',
    'docs//a.md', 'docs/[ab].md', '--fix', '**x.md', '']) {
    assert.throws(() => selectMarkdownFiles(directory, configuration, [pattern]), /unsupported/);
  }
  assert.throws(() => validatePatterns(Array(129).fill('*.md'), 'test'), /128/);
});

test('invalid JSON, unsupported configuration and empty selections fail closed', context => {
  const { directory, put } = fixture(context);
  assert.throws(() => selectMarkdownFiles(directory, configuration), /No eligible/);
  put('README.md');
  assert.throws(() => selectMarkdownFiles(directory, configuration, ['missing.md']), /No eligible/);
  for (const content of ['{', 'null', JSON.stringify({ globs: [], ignores: [], fix: true }),
    JSON.stringify({ globs: 'docs/*.md', ignores: [] }), ' '.repeat(65_537)]) {
    put('.markdownlint-repo.json', content);
    assert.throws(() => readLintConfiguration(directory));
  }
  put('.markdownlint-repo.json', JSON.stringify({ globs: configuration.globs, ignores: configuration.ignores }));
  put('.markdownlint.json', 'null');
  assert.throws(() => readLintConfiguration(directory), /JSON object/);
});

test('real markdownlint keeps MD012/MD047, useful diagnostics and read-only behavior', async context => {
  const { directory, put } = fixture(context);
  const lines = [];
  const errors = [];
  const run = () => runMarkdownLint({ root: directory, log: line => lines.push(line), error: line => errors.push(line) });
  put('README.md', '# Valid\n\nText.\n');
  assert.equal(await run(), 0);
  put('docs/invalid.md', '# Title\n\n\nText.');
  assert.equal(await run(), 1);
  assert.equal(errors.length, 2);
  assert.ok(errors.some(line => /^docs\/invalid.md:3:1 MD012 /u.test(line)));
  assert.ok(errors.some(line => /^docs\/invalid.md:4:\d+ MD047 /u.test(line)));
  assert.equal(readFileSync(resolve(directory, 'docs/invalid.md'), 'utf8'), '# Title\n\n\nText.');
  assert.equal(lines.at(-1), 'Markdown: 2 files checked; 2 errors');
});

test('the CLI returns nonzero for malformed patterns and missing explicit targets', () => {
  for (const pattern of ['--fix', 'not-a-real-document.md']) {
    const result = spawnSync(process.execPath, ['scripts/run-markdownlint.mjs', pattern],
      { cwd: root, encoding: 'utf8', shell: false, windowsHide: true, timeout: 10_000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Markdown lint failed:/);
  }
});

for (const workspace of ['', 'server/', 'client/']) {
  test(`${workspace || 'root'} lock no longer contains the retired vulnerable tooling`, () => {
    const lock = JSON.parse(readFileSync(resolve(root, `${workspace}package-lock.json`), 'utf8'));
    for (const location of Object.keys(lock.packages)) {
      assert.doesNotMatch(location, /(?:^|\/)node_modules\/(?:braces|micromatch|markdownlint-cli2|nodemon|markdown-it|linkify-it)$/u);
    }
  });
}
