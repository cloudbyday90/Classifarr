/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from '@jest/globals';

const workflow = name => load(readFileSync(new URL(`../../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

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

test('PR 537 pins all OSV entrypoints and preserves failure gates and Dependabot least privilege', () => {
  const osv = workflow('osv-scanner'), revision = 'a345acffa64b0eaede81a3d9aae6141214d9c8fc';
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
      for (const step of job.steps) if (step.uses?.startsWith('github/codeql-action/')) {
        expect(step.uses).toMatch(/^github\/codeql-action\/(init|analyze|upload-sarif)@[a-f0-9]{40}$/);
        references.push(step.uses.split('@')[1]);
      }
    }
  }
  expect(references).toHaveLength(4);
  expect(new Set(references).size).toBe(1);
  expect(codeql.jobs.analyze.strategy.matrix.language).toEqual(['javascript-typescript', 'actions']);
  expect(codeql.jobs.analyze.steps.find(step => step.uses?.includes('/init@')).with.queries).toBe('security-extended');
  expect(trivy.jobs['trivy-fs'].steps.find(step => step.name === 'Run Trivy (PR gate)').with['exit-code']).toBe('1');
});
