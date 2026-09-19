/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from '@jest/globals';

const workflow = name => load(readFileSync(new URL(`../../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

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
