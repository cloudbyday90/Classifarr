/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load, JSON_SCHEMA } from 'js-yaml';
import { expect, test } from '@jest/globals';

const root = new URL('../../../../', import.meta.url);
const config = load(readFileSync(new URL('.github/dependabot.yml', root), 'utf8'), { schema: JSON_SCHEMA });
const entries = [
  ['github-actions', '/', '03:00', 5, ['dependencies', 'github-actions']],
  ['npm', '/', '03:30', 5, ['dependencies', 'npm', 'root']],
  ['npm', '/client', '04:00', 10, ['dependencies', 'npm', 'client']],
  ['npm', '/server', '04:30', 10, ['dependencies', 'npm', 'server']],
];
const entry = (ecosystem, directory) => config.updates.find(update =>
  update['package-ecosystem'] === ecosystem && update.directory === directory);

test('Dependabot covers each workspace once without introducing global restrictions', () => {
  expect(Object.keys(config).sort()).toEqual(['updates', 'version']);
  expect(config.version).toBe(2);
  expect(config.updates.map(update => [update['package-ecosystem'], update.directory]))
    .toEqual(entries.map(([ecosystem, directory]) => [ecosystem, directory]));
});

test.each(entries)('%s %s retains scheduling, grouping and update availability', (ecosystem, directory, time, limit, labels) => {
  const update = entry(ecosystem, directory);
  const workspace = directory.slice(1);
  const scoped = ecosystem === 'npm' && workspace !== '';
  // An allowlist, alternate target, excludes, cooldown or disabled PR limit can
  // silently broaden the policy. Require deliberate review for new settings.
  expect(Object.keys(update).sort()).toEqual([
    'directory', 'groups', ...(scoped ? ['ignore'] : []), 'labels',
    'open-pull-requests-limit', 'package-ecosystem', 'schedule',
  ].sort());
  expect(update.schedule).toEqual({ interval: 'weekly', day: 'monday', time, timezone: 'America/New_York' });
  expect(update['open-pull-requests-limit']).toBe(limit);
  expect(update.labels).toEqual(labels);
  expect(update.groups).toEqual(scoped ? {
    [`${workspace}-runtime`]: { 'dependency-type': 'production', patterns: ['*'] },
    [`${workspace}-tooling`]: { 'dependency-type': 'development', patterns: ['*'] },
  } : { [ecosystem === 'npm' ? 'root-npm' : 'github-actions']: { patterns: ['*'] } });
});

test.each(['/client', '/server'])('%s excludes only routine Node declaration major updates', directory => {
  const expected = [{ 'dependency-name': '@types/node', 'update-types': ['version-update:semver-major'] }];
  if (directory === '/client') expected.unshift({ 'dependency-name': 'typescript', versions: ['7.x'] });
  // Exact comparison rejects wildcard names, versions ranges, patch/minor
  // exclusions and additional ignores. Security-only semantics are documented
  // from upstream code; this test does not simulate the hosted Dependabot engine.
  expect(entry('npm', directory).ignore).toEqual(expected);
});

test('runtime alignment remains guarded independently of proposal filtering', () => {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  expect(manifest.scripts['test:tooling:dependencies']).toContain('scripts/__tests__/container-runtime-baseline.test.mjs');
  const workflow = load(readFileSync(new URL('.github/workflows/copyright-compliance.yml', root), 'utf8'), { schema: JSON_SCHEMA });
  const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
  expect(steps.some(step => step.run === 'npm run test:tooling:dependencies' && !step['continue-on-error'] && !step.if)).toBe(true);
});
