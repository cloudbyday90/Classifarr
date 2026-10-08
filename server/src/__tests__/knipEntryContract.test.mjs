/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reported, runKnip, withFixture } from './helpers/knipCliFixture.mjs';

describe('installed Knip entry-boundary contracts', () => {
  test('wildcard package exports do not let tests hide production-only unused exports', () => {
    withFixture({
      'src/index.mjs': "import { live } from './operations.mjs';\nlive();\n",
      'src/operations.mjs': 'export function live() {}\nexport function testOnly() {}\n',
      'src/operations.test.mjs': "import { testOnly } from './operations.mjs';\nimport 'fixture-test-missing';\ntestOnly();\n",
    }, directory => {
      const normal = runKnip(directory, ['--include-entry-exports']);
      const production = runKnip(directory, ['--production', '--include-entry-exports']);
      expect(normal.status).toBe(1);
      expect(production.status).toBe(1);
      expect(reported(normal, 'exports')).toEqual([]);
      expect(reported(normal, 'unlisted')).toEqual(['src/operations.test.mjs:fixture-test-missing']);
      expect(reported(production, 'exports')).toEqual(['src/operations.mjs:testOnly']);
      expect(reported(production, 'unlisted')).toEqual([]);
    }, {
      manifest: { exports: { '.': './src/index.mjs', './*': './src/*.mjs' }, devDependencies: { jest: '*' } },
      config: { entry: [], project: ['src/**/*.mjs!'], jest: { entry: ['src/**/*.test.mjs'] } },
    });
  });

  test('development entry negations do not remove reachable production files', () => {
    withFixture({
      'src/generated/client.mjs': 'export const createClient = () => 1;\n',
      'src/client.test.mjs': "import { createClient } from './generated/client.mjs';\ncreateClient();\n",
    }, directory => {
      const normal = runKnip(directory, ['--include-entry-exports', '--exports']);
      const production = runKnip(directory, ['--production', '--include-entry-exports', '--exports']);
      expect(normal.status).toBe(0);
      expect(reported(normal, 'exports')).toEqual([]);
      expect(production.status).toBe(1);
      expect(reported(production, 'exports')).toEqual(['src/generated/client.mjs:createClient']);
    }, {
      manifest: { exports: { './client': './src/generated/client.mjs' }, devDependencies: { jest: '*' } },
      config: { entry: [], project: ['src/**/*.mjs!'], jest: { entry: ['src/**/*.mjs', '!src/generated/**'] } },
    });
  });

  test('null package exports expose private orphans without hiding internally used modules', () => {
    withFixture({
      'src/index.mjs': "import { retained } from './internal/format.mjs';\nretained();\n",
      'src/internal/format.mjs': 'export function retained() {}\nexport function unused() {}\n',
      'src/internal/orphan.mjs': 'export const orphan = 1;\n',
      'src/public.mjs': 'export const publicValue = 1;\n',
    }, directory => {
      const result = runKnip(directory);
      expect(result.status).toBe(1);
      expect(reported(result, 'exports')).toEqual(['src/internal/format.mjs:unused']);
      const files = JSON.parse(result.stdout).issues
        .filter(issue => issue.files?.length > 0)
        .map(issue => issue.file.replaceAll('\\', '/')).sort();
      expect(files).toEqual(['src/internal/orphan.mjs']);
    }, {
      manifest: { exports: { '.': './src/index.mjs', './*': './src/*.mjs', './internal/*': null } },
      config: { entry: [], project: ['src/**/*.mjs!'] },
    });
  });
});
