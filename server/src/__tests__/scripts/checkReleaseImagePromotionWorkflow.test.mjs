/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { loadWorkflow, validateReleaseCandidatePublicationWorkflow } from '../../scripts/checkReleaseCandidatePublicationWorkflow.mjs';

const promotion = () => loadWorkflow(resolve(import.meta.dirname, '../../../../.github/workflows/promote-published-release-image.yml'));

test.each([
  job => { job.needs.pop(); }, job => { job.if = 'always()'; }, job => { job['continue-on-error'] = true; },
  job => { job.with.image_digest = 'latest'; }, job => { job.uses = 'untrusted/repo/workflow@main'; },
])('rejects an automatic promotion bypass', mutate => {
  const ci = loadWorkflow(); mutate(ci.jobs['promote-published-latest']);
  expect(() => validateReleaseCandidatePublicationWorkflow(ci, promotion())).toThrow();
});

test.each([
  job => { job.concurrency.group = 'other-lock'; }, job => { job.concurrency['cancel-in-progress'] = true; },
  job => { job.environment = 'unprotected'; }, job => { job.permissions.contents = 'write'; },
  job => { job['timeout-minutes'] = 360; }, job => { job.steps[0].with['fetch-depth'] = 1; },
  job => { job.steps[5]['continue-on-error'] = true; }, job => { job.steps[5].if = 'false'; },
  job => { job.steps[5].run += ' || true'; }, job => { job.steps[4].with.password = 'inline'; },
  job => { job.steps[6].with.path = '.tmp/'; }, job => { job.steps.push({ run: 'docker push bad:latest' }); },
])('manual and automatic callers share the same non-bypassable bounded implementation', mutate => {
  const workflow = promotion(); mutate(workflow.jobs['promote-latest']);
  expect(() => validateReleaseCandidatePublicationWorkflow(loadWorkflow(), workflow)).toThrow();
});

test.each(['latest=auto', 'latest=true', undefined])('build metadata cannot automatically publish latest (%s)', flavor => {
  const ci = loadWorkflow(); ci.jobs['docker-release'].steps.find(step => step.id === 'meta').with.flavor = flavor;
  expect(() => validateReleaseCandidatePublicationWorkflow(ci, promotion())).toThrow();
});
