/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { EXPECTED_RELEASE_REPOSITORY } from './publishedDigestConsumerSmoke.mjs';

const requiredJobs = [
  { name: 'Published Routing (amd64)', runner: 'ubuntu-24.04', steps: ['Verify and rehearse published routing'] },
  { name: 'Published Routing (arm64)', runner: 'ubuntu-24.04-arm', steps: [
    'Verify and rehearse published routing', 'Rehearse release arm64 scheduled recovery', 'Upload release arm64 scheduled recovery receipt',
  ] },
  { name: 'Release Candidate Publication', steps: ['Create and verify immutable GitHub release'] },
  { name: 'Promote accepted images to latest / Promote verified release digest to latest', steps: ['Verify release and promote exact indexes'] },
];

export function validateReleaseWorkflowIdentity({ runId, runAttempt }) {
  assert.match(runId, /^[1-9][0-9]{0,15}$/);
  assert.match(runAttempt, /^[1-9][0-9]{0,8}$/);
  assert.ok(Number.isSafeInteger(Number(runId)));
  return { runId, runAttempt };
}

function assertSuccess(result) {
  assert.equal(result.status, 'completed');
  assert.equal(result.conclusion, 'success');
}

export function verifyPublishedReleaseAttempt({ command, tag, sourceRevision, workflow }) {
  const { runId, runAttempt } = validateReleaseWorkflowIdentity(workflow);
  const path = `repos/${EXPECTED_RELEASE_REPOSITORY}/actions/runs/${runId}/attempts/${runAttempt}`;
  const get = endpoint => JSON.parse(command('gh', ['api', endpoint]));
  const attempt = get(path);
  assert.equal(attempt.id, Number(runId));
  assert.equal(attempt.run_attempt, Number(runAttempt));
  assert.equal(attempt.event, 'push');
  assert.equal(attempt.path, '.github/workflows/ci.yml');
  assert.equal(attempt.head_branch, tag);
  assert.equal(attempt.head_sha, sourceRevision);
  assertSuccess(attempt);

  const { total_count: count, jobs } = get(`${path}/jobs?per_page=100`);
  assert.ok(Array.isArray(jobs) && jobs.length === count && jobs.length <= 100);
  for (const { name, runner, steps } of requiredJobs) {
    const matches = jobs.filter(job => job.name === name);
    assert.equal(matches.length, 1);
    const [job] = matches;
    assert.equal(job.run_id, Number(runId));
    assert.equal(job.run_attempt, Number(runAttempt));
    assert.equal(job.head_sha, sourceRevision);
    assertSuccess(job);
    if (runner) assert.ok(Array.isArray(job.labels) && job.labels.includes(runner));
    for (const step of steps) {
      const matching = job.steps.filter(entry => entry.name === step);
      assert.equal(matching.length, 1);
      assertSuccess(matching[0]);
    }
  }
}
