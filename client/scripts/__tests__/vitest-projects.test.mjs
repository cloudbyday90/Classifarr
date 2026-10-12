/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';
import { createVitest } from 'vitest/node';

const clientRoot = resolve(import.meta.dirname, '../..');
const relativePath = file => relative(clientRoot, file).replaceAll('\\', '/');

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
