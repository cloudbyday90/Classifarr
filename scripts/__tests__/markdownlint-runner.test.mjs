/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readLintConfiguration, selectMarkdownFiles } from '../markdownlint/files.mjs';
import { matchesPattern, validatePatterns } from '../markdownlint/patterns.mjs';
import { runMarkdownLint } from '../markdownlint/run.mjs';
import stringWidth from 'string-width';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configuration = readLintConfiguration(root);

test('markdownlint resolves the reviewed RE2JS artifact without a second consumer copy', () => {
  const require = createRequire(import.meta.url);
  const consumer = createRequire(require.resolve('markdownlint'));
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const installed = JSON.parse(readFileSync(resolve(root, 'node_modules/re2js/package.json'), 'utf8'));
  assert.equal(pkg.overrides.markdownlint.re2js, '2.8.7');
  assert.equal(lock.packages['node_modules/re2js'].version, '2.8.7');
  assert.equal(installed.version, '2.8.7');
  assert.equal(consumer.resolve('re2js'), require.resolve('re2js'));
});

function runRe2jsProbe(source) {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', source],
    { cwd: root, encoding: 'utf8', shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 64 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('real repeated lookbehind matching bounds observed input reads and preserves every match', () => {
  const results = runRe2jsProbe(`
    import assert from 'node:assert/strict';
    import { RE2JS, MatcherInput } from 're2js';
    const pattern = RE2JS.compile('(?<=a)b', RE2JS.LOOKBEHINDS);
    const nativeCharCodeAt = String.prototype.charCodeAt;
    const collect = matcher => {
      const matches = [];
      while (matcher.find()) matches.push([matcher.start(), matcher.end(), matcher.group()]);
      return matches;
    };
    const results = [];
    for (const size of [256, 512]) {
      const text = 'ab'.repeat(size / 2);
      const sequence = new String(text);
      let reads = 0;
      // Per-input observation only; neither vendor code nor a global prototype is changed.
      Object.defineProperty(sequence, 'charCodeAt', { value(index) {
        reads++; return nativeCharCodeAt.call(this, index);
      } });
      const actual = collect(pattern.matcher(MatcherInput.utf16(sequence)));
      assert.deepEqual(actual, Array.from({ length: size / 2 }, (_, i) => [2 * i + 1, 2 * i + 2, 'b']));
      assert.deepEqual(actual, collect(pattern.matcher(text)));
      assert.ok(reads > 0, 'observer must remain active');
      results.push({ size, reads, matches: actual.length });
    }
    console.log(JSON.stringify(results));
  `);
  for (const { size, reads, matches } of results) {
    assert.equal(matches, size / 2);
    // A generous bound on this fixed scan, not a wall-clock or universal complexity claim.
    assert.ok(reads <= 64 * size, `${size} characters required ${reads} input reads`);
  }
});

test('real RE2JS retains default flags, repeated APIs, reset and Unicode behavior', () => {
  const result = runRe2jsProbe(`
    import assert from 'node:assert/strict';
    import { RE2JS } from 're2js';
    assert.throws(() => RE2JS.compile('(?<=a)b'));
    const positive = RE2JS.compile('(?<=a)b', RE2JS.LOOKBEHINDS);
    const negative = RE2JS.compile('(?<!a)b', RE2JS.LOOKBEHINDS);
    assert.equal(positive.test('ab'), true); assert.equal(positive.test('cb'), false);
    assert.equal(negative.test('cb'), true); assert.equal(negative.test('ab'), false);
    assert.deepEqual([...positive.matchAll('abab')].map(match => [match.index, match[0]]), [[1, 'b'], [3, 'b']]);
    assert.equal(positive.matcher('abab').replaceAll('X'), 'aXaX');
    assert.deepEqual(positive.split('abab'), ['a', 'a']);
    const matcher = positive.matcher('abab');
    assert.equal(matcher.find(), true); assert.equal(matcher.start(), 1);
    assert.equal(matcher.find(), true); assert.equal(matcher.start(), 3);
    matcher.reset(); assert.equal(matcher.find(), true); assert.equal(matcher.start(), 1);
    matcher.resetMatcherInput('cbab'); assert.equal(matcher.find(), true); assert.equal(matcher.start(), 3);
    const unicode = RE2JS.compile('古|👩🏽‍💻|e\\u0301');
    assert.deepEqual([...unicode.matchAll('古 👩🏽‍💻 e\\u0301')].map(match => match[0]), ['古', '👩🏽‍💻', 'e\\u0301']);
    assert.equal(RE2JS.compile('ab').matcher('abab').replaceAll('X'), 'XX');
    console.log(JSON.stringify({ controls: 'passed' }));
  `);
  assert.equal(result.controls, 'passed');
});

test('markdownlint uses its supported display-width dependency without the retired downgrade', () => {
  const pkg = JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
  assert.equal(pkg.devDependencies.markdownlint,lock.packages['node_modules/markdownlint'].version);
  assert.equal(pkg.overrides['string-width'],undefined);
  assert.equal(lock.packages['node_modules/markdownlint'].dependencies['string-width'],lock.packages['node_modules/string-width'].version);
  for (const [text,width] of [['abc',3],['古',2],['e\u0301',1],['👩🏽‍💻',2],['\u001B[31mred\u001B[0m',3]]) assert.equal(stringWidth(text),width);
});

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
