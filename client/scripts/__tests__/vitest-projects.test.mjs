/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { globSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';
import { createVitest } from 'vitest/node';
import { build } from 'vite';

const clientRoot = resolve(import.meta.dirname, '../..');
const relativePath = file => relative(clientRoot, file).replaceAll('\\', '/');

test('real Vite retains CSS dependencies for query-bearing dynamic imports and ordinary imports', { timeout: 10_000 }, async () => {
  const boundary = resolve(clientRoot, '.tmp');
  mkdirSync(boundary, { recursive: true });
  const directory = mkdtempSync(resolve(boundary, 'vite-query-css-'));
  try {
    writeFileSync(resolve(directory, 'index.html'), '<script type="module" src="/main.js"></script>');
    writeFileSync(resolve(directory, 'main.js'), "import './static.css'; globalThis.loadQuery = () => import('./lazy.js?sample=one'); globalThis.loadOrdinary = () => import('./ordinary.js');");
    writeFileSync(resolve(directory, 'lazy.js'), "import './lazy.css'; export const value = 'query-sentinel';");
    writeFileSync(resolve(directory, 'ordinary.js'), "import './ordinary.css'; export const value = 'ordinary-sentinel';");
    for (const name of ['static', 'lazy', 'ordinary']) writeFileSync(resolve(directory, `${name}.css`), `.${name}-sentinel { color: red; }`);
    const result = await build({ root: directory, configFile: false, logLevel: 'silent', build: { write: false, minify: false } });
    const output = result.output;
    const entry = output.find(item => item.type === 'chunk' && item.isEntry);
    assert.ok(entry, 'entry must be emitted');
    assert.equal(entry.dynamicImports.length, 2);
    for (const name of ['lazy', 'ordinary']) {
      const chunk = output.find(item => item.type === 'chunk' && item.code.includes(`${name === 'lazy' ? 'query' : 'ordinary'}-sentinel`));
      assert.ok(chunk, `${name} dynamic chunk must exist`);
      assert.ok(entry.dynamicImports.includes(chunk.fileName));
      const styles = [...chunk.viteMetadata.importedCss];
      assert.equal(styles.length, 1);
      assert.ok(output.some(item => item.type === 'asset' && item.fileName === styles[0] && String(item.source).includes(`.${name}-sentinel`)));
      assert.ok(entry.code.includes(styles[0]), 'dynamic preload must retain its CSS dependency');
    }
    assert.ok(output.some(item => item.type === 'asset' && String(item.source).includes('.static-sentinel')));
  } finally {
    assert.ok(directory.startsWith(`${boundary}\\`) || directory.startsWith(`${boundary}/`));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CI opts into bounded phase diagnostics without changing the client test command', () => {
  const workflow = readFileSync(resolve(clientRoot, '../.github/workflows/ci.yml'), 'utf8');
  const step = workflow.split(/ {6}- name: Run client tests\r?\n/)[1]?.split(/\r?\n {6}- name:/)[0];
  assert.ok(step, 'client test step must exist');
  assert.match(step, /CLASSIFARR_TEST_PHASE_DIAGNOSTICS: '1'/);
  assert.match(step, /cd client\s+npm run test:ci/);
  assert.doesNotMatch(step, /continue-on-error|--retry|--testTimeout|--hookTimeout|\|\|\s*true/);
});

test('installed test runner and coverage provider match their exact manifest pins', () => {
  const read = path => JSON.parse(readFileSync(resolve(clientRoot, path), 'utf8'));
  const manifest = read('package.json');
  const lock = read('package-lock.json');
  const version = manifest.devDependencies.vitest;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  for (const name of ['vitest', '@vitest/coverage-v8']) {
    assert.equal(manifest.devDependencies[name], version);
    assert.equal(lock.packages[''].devDependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.equal(read(`node_modules/${name}/package.json`).version, version);
  }
  assert.equal(read('node_modules/@vitest/coverage-v8/package.json').peerDependencies.vitest, version);
});

test('resolved projects preserve every suite and isolate lint setup from application work', { timeout: 10_000 }, async () => {
  // Run outside Vitest so this inspects the real resolved configuration without
  // starting a nested runner inside one of the application workers.
  const runner = await createVitest({ root: clientRoot, watch: false });
  try {
    const projects = runner.projects;
    assert.deepEqual(projects.map(project => project.name).sort(), ['application', 'lint-contracts']);
    const lint = projects.find(project => project.name === 'lint-contracts');
    const application = projects.find(project => project.name === 'application');
    assert.equal(lint.config.sequence.groupOrder, 1);
    assert.equal(application.config.sequence.groupOrder, 2);
    assert.equal(lint.config.maxWorkers, 1);
    assert.equal(lint.config.fileParallelism, false);
    assert.equal(application.config.maxWorkers, 4);
    assert.equal(application.config.fileParallelism, true);
    assert.equal(lint.config.environment, 'node');
    assert.equal(application.config.environment, 'jsdom');

    for (const project of projects) {
      assert.equal(project.config.pool, 'forks');
      assert.equal(project.config.isolate, true);
      assert.equal(project.config.hookTimeout, 10_000);
      assert.equal(project.config.testTimeout, 5_000);
      assert.equal(project.config.globals, true);
      assert.deepEqual(project.config.setupFiles.map(relativePath), ['vitest.setup.js']);
      assert.ok(project.vite.config.plugins.some(plugin => plugin.name === 'vite:vue'));
      const alias = project.vite.config.resolve.alias.find(entry => entry.find === '@');
      assert.equal(relativePath(alias.replacement), 'src');
    }
    assert.equal(runner.config.coverage.provider, 'v8');
    assert.equal(runner.config.fsModuleCache, true);

    const specifications = await runner.globTestSpecifications();
    const actual = specifications.map(specification => relativePath(specification.moduleId)).sort();
    const expected = globSync('src/__tests__/**/*.test.js', { cwd: clientRoot })
      .map(file => file.replaceAll('\\', '/')).sort();
    assert.ok(expected.length > 0);
    assert.deepEqual(actual, expected, 'no missing or duplicate test files across projects');
    assert.deepEqual(specifications.filter(specification => specification.project === lint)
      .map(specification => relativePath(specification.moduleId)).sort(), [
      'src/__tests__/lintToolingContract.test.js',
      'src/__tests__/security/csrfClientUsage.test.js',
      'src/__tests__/vueEventLintContract.test.js',
    ]);
    assert.ok(actual.every(file => !file.startsWith('browser-tests/')));

  } finally {
    await runner.close();
  }
});
