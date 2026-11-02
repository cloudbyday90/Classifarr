/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { setImmediate as immediate } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sorted = entries => entries.map(entry => entry.replaceAll('\\', '/')).sort();

async function fixture(operation) {
  const parent = path.join(root, '.tmp');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'glob-security-'));
  assert.ok(directory.startsWith(parent + path.sep));
  try {
    for (const name of ['a/one/deep/file.txt', 'a/two/deep/file.txt',
      'b/one/deep/file.txt', 'b/two/deep/file.txt', 'src/keep.js', 'src/skip.test.js', 'other.js']) {
      await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
      await writeFile(path.join(directory, name), 'const value={answer:42};\n');
    }
    await operation(directory);
  } finally {
    // This is the freshly minted fixture, never an operator-selected path.
    await rm(directory, { recursive: true, force: true });
  }
}

async function cancelledWalk(glob, kind, cwd) {
  const controller = new AbortController();
  const reason = new Error('synthetic_glob_abort');
  let calls = 0, afterAbort = 0, pending = 0;
  const observedFs = { ...fs, readdir(target, options, callback) {
    calls++; pending++;
    if (controller.signal.aborted) afterAbort++;
    fs.readdir(target, options, (error, entries) => {
      // Abort before giving the walker its first directory result. Any later
      // read is new work, not an operation already dispatched before abort.
      if (!controller.signal.aborted) controller.abort(reason);
      try { callback(error, entries); } finally { pending--; }
    });
  } };
  let observed;
  try {
    const walk = glob[kind]('**/*.txt', { cwd, signal: controller.signal, fs: observedFs });
    if (kind === 'glob') await walk;
    else for await (const entry of walk) void entry;
  } catch (error) { observed = error; }
  // Drain the real, small filesystem fixture before asserting or deleting it.
  // This deadline guards the harness, not a performance assertion about glob.
  const deadline = Date.now() + 3000;
  for (;;) {
    await immediate();
    if (pending === 0) { await immediate(); if (pending === 0) break; }
    if (Date.now() >= deadline) throw new Error('glob_fixture_drain_timeout');
  }
  assert.equal(observed, reason);
  assert.equal(pending, 0);
  assert.equal(calls, 1, 'aborted traversal must not admit another readdir');
  assert.equal(afterAbort, 0);
}

test('dependency CI installs all three independent trees before the suite', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/copyright-compliance.yml'), 'utf8');
  const positions = ['run: npm ci', 'run: npm --prefix server ci',
    'run: npm --prefix client ci', 'run: npm run test:tooling:dependencies'].map(step => workflow.indexOf(step));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.match(workflow, /server\/package-lock\.json/);
});

for (const tree of ['server', 'client']) {
  const base = path.join(root, tree);
  const require = createRequire(path.join(base, 'package.json'));
  const json = async name => JSON.parse(await readFile(path.join(base, name), 'utf8'));
  const manifest = await json('package.json');
  const lock = await json('package-lock.json');

  test(`${tree}: coherent exact overrides, locks and installed artifacts`, () => {
    for (const [name, version] of [['glob', '14.0.3'], ['minimatch', '11.0.4']]) {
      assert.equal(manifest.overrides[name], version);
      assert.equal(lock.packages[`node_modules/${name}`].version, version);
      assert.equal(lock.packages[`node_modules/${name}`].dev, true);
      assert.equal(require(`${name}/package.json`).version, version);
    }
  });

  for (const format of ['require', 'import']) {
    const load = async name => {
      if (format === 'require') return require(name);
      const metadata = require(`${name}/package.json`);
      const entry = metadata.exports['.'].import.default;
      return import(pathToFileURL(path.join(base, 'node_modules', name, entry)).href);
    };
    const glob = await load('glob'), { Minimatch, minimatch } = await load('minimatch');

    for (const kind of ['glob', 'globStream']) {
      test(`${tree}/${format}: ${kind} stops admitting reads after abort`, { timeout: 10000 }, async () => {
        await fixture(cwd => cancelledWalk(glob, kind, cwd));
      });
    }

    test(`${tree}/${format}: optimization honors the four-row expansion budget`, () => {
      const pattern = '**/../a/b/'.repeat(8) + 'target.txt';
      const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 4 });
      assert.ok(matcher.globParts.length <= 4, `actual rows: ${matcher.globParts.length}`);
      assert.equal(matcher.match('a/b/target.txt'), false);
      // The intentionally tiny budget need not retain all over-budget matches.
      // Prove exact positive semantics when the declared budget admits them.
      assert.equal(new Minimatch('**/../a/b/target.txt', {
        optimizationLevel: 2, braceExpandMax: 4,
      }).match('a/b/target.txt'), true);
      assert.equal(new Minimatch(pattern, {
        optimizationLevel: 2, braceExpandMax: 1024,
      }).match('a/b/'.repeat(8) + 'target.txt'), true);
    });

    test(`${tree}/${format}: legitimate matching and option-sensitive caches remain exact`, () => {
      for (const [file, pattern, options, expected] of [
        ['src/keep.js', 'src/*.js', {}, true], ['src/keep.ts', 'src/*.{js,mjs}', {}, false],
        ['src/keep.mjs', 'src/*.{js,mjs}', {}, true], ['src/keep.js', 'src/+(keep|other).js', {}, true],
        ['a/b/c.txt', '**/*.txt', {}, true], ['a/b/c.txt', '!**/*.txt', {}, false],
        ['.hidden', '*', {}, false], ['.hidden', '*', { dot: true }, true],
        ['FILE.JS', '*.js', { nocase: true }, true], ['FILE.JS', '*.js', { nocase: false }, false],
        ['C:\\src\\keep.js', 'C:/src/*.js', { platform: 'win32', windowsPathsNoEscape: true }, true],
      ]) assert.equal(minimatch(file, pattern, options), expected, `${file} ${pattern}`);
      const options = { dot: false };
      const before = new Minimatch('*', options);
      options.dot = true;
      assert.equal(new Minimatch('*', options).match('.hidden'), true);
      assert.equal(before.match('.hidden'), false);
      assert.equal(new Minimatch('*', { dot: false }).match('.hidden'), false);
    });

    test(`${tree}/${format}: async, sync and stream glob return the same exact files`, async () => {
      await fixture(async cwd => {
        const expected = ['a/one/deep/file.txt', 'a/two/deep/file.txt', 'b/one/deep/file.txt', 'b/two/deep/file.txt'];
        assert.deepEqual(sorted(await glob.glob('**/*.txt', { cwd })), expected);
        assert.deepEqual(sorted(glob.globSync('**/*.txt', { cwd })), expected);
        const stream = [];
        for await (const entry of glob.globStream('**/*.txt', { cwd })) stream.push(entry);
        assert.deepEqual(sorted(stream), expected);
      });
    });
  }

  if (tree === 'server') {
    test('server: real coverage, archive and readdir consumers retain include/exclude behavior', async () => {
      await fixture(async cwd => {
        const TestExclude = require('test-exclude');
        const exclusion = new TestExclude({ cwd, include: ['src/**/*.js'], exclude: ['**/*.test.js'] });
        assert.deepEqual(sorted(await exclusion.glob(cwd)), ['src/keep.js']);
        assert.equal(exclusion.shouldInstrument(path.join(cwd, 'src/skip.test.js')), false);
        const archive = require('archiver-utils');
        assert.deepEqual(sorted(archive.file.expand({ cwd }, ['src/*.js', '!**/*.test.js'])), ['src/keep.js']);
        const matches = [];
        await new Promise((resolve, reject) => {
          require('readdir-glob')(cwd, { pattern: '**/*.js', ignore: '**/*.test.js', nodir: true })
            .on('match', entry => matches.push(entry.relative)).once('end', resolve).once('error', reject);
        });
        assert.deepEqual(sorted(matches), ['other.js', 'src/keep.js']);
      });
    });
  } else {
    test('client: real EditorConfig and beautifier CLI retain file matching', async () => {
      await fixture(async cwd => {
        await writeFile(path.join(cwd, '.editorconfig'), 'root = true\n\n[*.js]\nindent_style = space\nindent_size = 2\n\n[*.txt]\nindent_size = 4\n');
        const editorconfig = require('editorconfig');
        assert.equal((await editorconfig.parse(path.join(cwd, 'src/keep.js'))).indent_size, 2);
        assert.equal((await editorconfig.parse(path.join(cwd, 'a/one/deep/file.txt'))).indent_size, 4);
        const cli = path.join(base, 'node_modules/js-beautify/js/bin/js-beautify.js');
        const output = execFileSync(process.execPath, [cli, '--file', 'src/keep*.js', '--indent-size', '2'],
          { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
        assert.equal(output.trim().replaceAll('\\', '/'), 'beautified src/keep.js');
        assert.equal((await readFile(path.join(cwd, 'src/keep.js'), 'utf8')).replaceAll('\r', '').trim(),
          'const value = {\n  answer: 42\n};');
      });
    });
  }
}
