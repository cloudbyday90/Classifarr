/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from '@jest/globals';

const workflow = name => load(readFileSync(new URL(`../../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

test.each([
  ['setup-node', '949feb2413d6458794dcd2491c4babbbce0c15c1', 13],
  ['upload-artifact', 'cf430e030ddbb5b0abf93d22962f4752f3646cd9', 14],
  ['download-artifact', '9000827ccba6bdab643e8b6fd33ac0654aef8333', 6],
])('all %s steps use the reviewed immutable release', (action, revision, count) => {
  const files = readdirSync(new URL('../../../../.github/workflows/', import.meta.url)).filter(file => file.endsWith('.yml'));
  const references = files.flatMap(file => Object.values(workflow(file.slice(0, -4)).jobs)
    .flatMap(job => job.steps ?? []).filter(step => step.uses?.startsWith(`actions/${action}@`)));
  expect(references).toHaveLength(count);
  for (const step of references) expect(step.uses).toBe(`actions/${action}@${revision}`);
});

test('PR 537 pins verified Docker revisions without changing tag-only publishing', () => {
  const ci = workflow('ci'), job = ci.jobs['docker-release'];
  expect(job.if).toBe("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
  expect(ci.on.pull_request_target).toBeUndefined();
  const expected = {
    'docker/setup-qemu-action': '99012661954931238ded8c8b007157a8430204e1',
    'docker/setup-buildx-action': 'f87e5991a6d7451dcb8d9637bfbc97413f497069',
    'docker/build-push-action': 'c3c9e263c25d99ce0380d002d59b67737d91b0dc',
  };
  for (const [action, revision] of Object.entries(expected)) {
    expect(job.steps.filter(step => step.uses?.startsWith(`${action}@`)).map(step => step.uses)).toEqual([`${action}@${revision}`]);
  }
  expect(job.permissions).toEqual({ attestations: 'write', contents: 'read', 'id-token': 'write', packages: 'write' });
});

test('PR 561 pins all OSV entrypoints and preserves failure gates and Dependabot least privilege', () => {
  const osv = workflow('osv-scanner'), revision = 'b1d267aea5211fa648d9d442fa64b90dbdcbdd36';
  expect(osv.on.pull_request_target).toBeUndefined();
  expect(osv.on.merge_group.branches).toEqual(['main']);
  const bot = osv.jobs['pr-scan-dependabot'];
  expect(bot.permissions).toEqual({ contents: 'read' });
  expect(bot.steps.filter(step => step.uses?.startsWith('google/')).map(step => step.uses))
    .toEqual([`google/osv-scanner-action/osv-scanner-action@${revision}`]);
  expect(bot.steps.some(step => step.uses?.includes('upload-sarif'))).toBe(false);
  for (const name of ['pr-scan', 'merge-group-scan', 'full-scan']) {
    const job = osv.jobs[name], file = name === 'full-scan' ? 'osv-scanner-reusable.yml' : 'osv-scanner-reusable-pr.yml';
    expect(job.uses).toBe(`google/osv-scanner-action/.github/workflows/${file}@${revision}`);
    expect(job.with['fail-on-vuln']).toBe(true);
    expect(job.permissions).toEqual({ contents: 'read', 'security-events': 'write', actions: 'read' });
  }
});

test('CodeQL and SARIF upload use one immutable action revision and unchanged least-privilege jobs', () => {
  const codeql = workflow('codeql'), trivy = workflow('trivy');
  const references = [];
  for (const config of [codeql, trivy]) {
    expect(config.on.pull_request.branches).toEqual(['main']);
    expect(config.on.push.branches).toEqual(['main']);
    expect(config.on.pull_request_target).toBeUndefined();
    for (const job of Object.values(config.jobs)) {
      expect(job.permissions).toEqual({ actions: 'read', contents: 'read', 'security-events': 'write' });
      expect(job['continue-on-error']).toBeUndefined();
      for (const step of job.steps) expect(step['continue-on-error']).toBeUndefined();
      for (const step of job.steps) if (step.uses?.startsWith('github/codeql-action/')) {
        expect(step.uses).toMatch(/^github\/codeql-action\/(init|analyze|upload-sarif)@[a-f0-9]{40}$/);
        references.push(step.uses.split('@')[1]);
      }
    }
  }
  expect(references).toHaveLength(4);
  expect(new Set(references).size).toBe(1);
  expect(references[0]).toBe('6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee'); // PR #561; upstream v4.39.0.
  expect(codeql.jobs.analyze.strategy.matrix.language).toEqual(['javascript-typescript', 'actions']);
  expect(codeql.jobs.analyze.steps.find(step => step.uses?.includes('/init@')).with.queries).toBe('security-extended');
  expect(codeql.jobs.analyze.steps.find(step => step.uses?.includes('/analyze@')).with.category)
    .toBe('/language:${{ matrix.language }}');
  for (const [jobName, category] of [['trivy-fs', 'trivy-fs'], ['trivy-config', 'trivy-config']]) {
    const upload = trivy.jobs[jobName].steps.find(step => step.uses?.includes('/upload-sarif@'));
    expect(upload.if).toBe('always()');
    expect(upload.with).toEqual({ sarif_file: `${category}-results.sarif`, category });
  }
  expect(trivy.jobs['trivy-fs'].steps.find(step => step.name === 'Run Trivy (PR gate)').with['exit-code']).toBe('1');
});
