/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const LOGIN_ID = 'dockerhub-pull-login';
const expression = value => '$' + `{{ ${value} }}`;
const TRUSTED_MAIN = "github.repository == 'cloudbyday90/Classifarr' && github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')";
const EXPECTED_LOGIN = {
  name: 'Authenticate Docker Hub pulls (requires DOCKERHUB_PULL_TOKEN)',
  id: LOGIN_ID,
  if: TRUSTED_MAIN,
  uses: 'docker/login-action@dbcb813823bdd20940b903addbd779551569679f',
  with: {
    registry: 'docker.io',
    username: expression('secrets.DOCKERHUB_USERNAME'),
    password: expression('secrets.DOCKERHUB_PULL_TOKEN'),
    logout: true,
  },
};

/** Validate the only registry credential boundary in a non-publishing job. */
export function validateDockerHubPullJob(job, firstConsumerName) {
  const logins = job.steps.filter(step => step.id === LOGIN_ID);
  assert.equal(logins.length, 1, 'Exactly one dedicated Docker Hub pull login is required.');
  assert.deepEqual(logins[0], EXPECTED_LOGIN);
  const loginIndex = job.steps.indexOf(logins[0]);
  assert.equal(job.steps[loginIndex + 1]?.name, firstConsumerName,
    'Authenticate immediately before the first image consumer.');
  assert.equal(job['runs-on'], 'ubuntu-latest');
  for (const key of ['continue-on-error', 'container', 'services', 'secrets', 'environment']) {
    assert.equal(job[key], undefined);
  }
  // These jobs must never gain publishing privileges or distribute credentials
  // through job env, another step, or a job-level expression.
  const withoutLogin = { ...job, steps: job.steps.filter(step => step.id !== LOGIN_ID) };
  assert.ok(!/secrets\s*(?:\.|\[)/i.test(JSON.stringify(withoutLogin)),
    'Pull credentials belong only to the guarded login action.');
  for (const value of Object.values(job.permissions ?? {})) assert.equal(value, 'read');
  return withoutLogin.steps;
}

export function validateDockerHubPullWorkflows(ci, resource) {
  for (const workflow of [ci, resource]) {
    assert.ok(!Object.hasOwn(workflow.on, 'pull_request_target'));
    assert.ok(!Object.hasOwn(workflow.on, 'workflow_run'));
    assert.ok(!/secrets\s*(?:\.|\[)/i.test(JSON.stringify(workflow.env ?? {})));
  }
  validateDockerHubPullJob(ci.jobs['build-and-test'], 'Build Docker image (verification)');
  validateDockerHubPullJob(ci.jobs['database-tests'], 'Run integration tests');
  validateDockerHubPullJob(ci.jobs['runtime-installation-acceptance'], 'Run isolated installation acceptance');
  assert.deepEqual(resource.permissions, { contents: 'read' });
  validateDockerHubPullJob(resource.jobs['resource-capacity'], 'Run short resource gate');
  return true;
}
