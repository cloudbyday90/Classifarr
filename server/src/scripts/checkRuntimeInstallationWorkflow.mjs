/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { loadWorkflow } from './checkReleaseCandidatePublicationWorkflow.mjs';
const expression = value => '$' + `{{ ${value} }}`;

/** Keep the installation gate in the same run and out of publishing privileges. */
export function validateRuntimeInstallationWorkflow(workflow) {
  const jobs = workflow.jobs;
  const job = jobs['runtime-installation-acceptance'];
  const mode = workflow.on.workflow_dispatch.inputs.mode;
  assert.equal(mode.type, 'choice');
  assert.equal(mode.required, true);
  assert.equal(mode.default, 'cleanup');
  assert.deepEqual(mode.options, ['cleanup', 'ci', 'installation-budget']);
  assert.equal(job['runs-on'], 'ubuntu-latest');
  assert.equal(job.if, "github.event_name != 'workflow_dispatch' || inputs.mode == 'ci' || inputs.mode == 'installation-budget'");
  assert.equal(job['timeout-minutes'], 40);
  assert.deepEqual(job.permissions, { contents: 'read', attestations: 'read' });
  for (const key of ['continue-on-error', 'environment', 'secrets', 'container', 'services', 'env', 'needs']) assert.equal(job[key], undefined);
  assert.equal(job.steps.length, 5);
  const [checkout, node, run, budget, upload] = job.steps;
  assert.equal(checkout.uses, 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1');
  assert.deepEqual(checkout.with, { 'persist-credentials': false });
  assert.equal(node.uses, 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020');
  assert.deepEqual(node.with, { 'node-version-file': '.nvmrc' });
  assert.equal(run.run, 'node scripts/run-runtime-installation-acceptance.mjs --ci');
  assert.equal(run.if, "github.event_name != 'workflow_dispatch' || inputs.mode == 'ci'");
  assert.equal(budget.run, 'node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget');
  assert.equal(budget.if, "github.event_name == 'workflow_dispatch' && inputs.mode == 'installation-budget'");
  for (const step of [run, budget]) {
    assert.deepEqual(step.env, { GH_TOKEN: expression('github.token'), CLASSIFARR_INSTALLATION_SOURCE_REVISION: expression('github.sha') });
  }
  for (const step of job.steps) assert.equal(step['continue-on-error'], undefined);
  for (const step of [checkout, node]) assert.equal(step.if, undefined);
  assert.equal(upload.if, 'always()');
  assert.equal(upload.uses, 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a');
  assert.deepEqual(upload.with, { name: 'runtime-installation-acceptance',
    path: '.tmp/ci/runtime-installation-acceptance.json\n.tmp/ci/runtime-installation-acceptance.md\n',
    'include-hidden-files': true, 'if-no-files-found': 'error', 'retention-days': 90 });
  assert.ok(!workflow.on.pull_request_target && !workflow.on.workflow_run);
  const acceptance = jobs['release-acceptance'];
  assert.deepEqual(acceptance.needs, ['build-and-test', 'database-tests', 'runtime-installation-acceptance']);
  const assemble = acceptance.steps.find(step => step.name === 'Assemble release acceptance readout');
  assert.ok(assemble.run.includes(`if [ "${expression('needs.database-tests.result')}" = "success" ] && [ "${expression('needs.runtime-installation-acceptance.result')}" = "success" ]; then`));
  assert.ok(assemble.run.includes('ISOLATED_RUNTIME_ACCEPTANCE="blocked"'));
  assert.ok(assemble.run.includes('--require-passed'));
  assert.equal(assemble['continue-on-error'], undefined);
  assert.equal(acceptance['continue-on-error'], undefined);
  for (const id of ['docker-release', 'release-candidate-publication']) assert.ok(jobs[id].needs.includes('release-acceptance'));
  const normalCi = "github.event_name == 'pull_request' || (github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))) || (github.event_name == 'workflow_dispatch' && inputs.mode == 'ci')";
  const compact = value => value.trim().replace(/\s+/g, ' ');
  assert.equal(jobs['build-and-test'].if, "github.event_name != 'workflow_dispatch' || inputs.mode == 'ci'");
  assert.equal(jobs['policy-candidate-synthetic-replay'].if, "github.event_name == 'pull_request'");
  assert.equal(compact(jobs['database-tests'].if), normalCi);
  assert.equal(compact(acceptance.if), `always() && ( ${normalCi} )`);
  // The opt-in drill is not a release, publication or retention-cleanup mode.
  for (const id of ['docker-release', 'published-digest-consumer-smoke', 'release-candidate-publication', 'release-candidate-provider-fault-receipt']) {
    assert.equal(jobs[id].if, "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
  }
  assert.equal(jobs['cleanup-old-releases-manual'].if, "github.event_name == 'workflow_dispatch' && inputs.mode == 'cleanup'");
  assert.deepEqual(jobs['cleanup-old-releases'].needs, ['docker-release', 'release-candidate-publication']);
  assert.equal(jobs['cleanup-old-releases'].if, "startsWith(github.ref, 'refs/tags/v')");
  return true;
}

if (import.meta.main) {
  validateRuntimeInstallationWorkflow(loadWorkflow());
  process.stdout.write('Runtime installation acceptance workflow contract passed.\n');
}
