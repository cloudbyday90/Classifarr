/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadWorkflow } from './checkReleaseCandidatePublicationWorkflow.mjs';
import { validateDockerHubPullJob, validateDockerHubPullWorkflows } from './dockerHubPullWorkflowContract.mjs';
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
  assert.equal(job['timeout-minutes'], 60);
  assert.deepEqual(job.outputs, { 'candidate-image-id': expression('steps.acceptance.outputs.candidate-image-id || steps.budget.outputs.candidate-image-id') });
  assert.deepEqual(job.permissions, { contents: 'read', attestations: 'read' });
  for (const key of ['continue-on-error', 'environment', 'secrets', 'container', 'services', 'env', 'needs']) assert.equal(job[key], undefined);
  const installationSteps = validateDockerHubPullJob(job, 'Run isolated installation acceptance');
  assert.equal(installationSteps.length, 6);
  const [checkout, node, run, budget, upload, diagnostic] = installationSteps;
  assert.equal(checkout.uses, 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1');
  assert.deepEqual(checkout.with, { 'persist-credentials': false, 'fetch-depth': 0 });
  assert.equal(node.uses, 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1');
  assert.deepEqual(node.with, { 'node-version-file': '.nvmrc' });
  assert.equal(run.run, 'node scripts/run-runtime-installation-acceptance.mjs --ci');
  assert.equal(run.id, 'acceptance');
  assert.equal(budget.id, 'budget');
  assert.equal(run.if, "github.event_name != 'workflow_dispatch' || inputs.mode == 'ci'");
  assert.equal(budget.run, 'node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget');
  assert.equal(budget.if, "github.event_name == 'workflow_dispatch' && inputs.mode == 'installation-budget'");
  for (const step of [run, budget]) {
    assert.deepEqual(step.env, { GH_TOKEN: expression('github.token'), CLASSIFARR_INSTALLATION_SOURCE_REVISION: expression('github.sha') });
  }
  for (const step of job.steps) assert.equal(step['continue-on-error'], undefined);
  for (const step of [checkout, node]) assert.equal(step.if, undefined);
  assert.equal(upload.if, 'always()');
  assert.equal(upload.uses, 'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9');
  assert.deepEqual(upload.with, { name: 'runtime-installation-acceptance',
    path: '.tmp/ci/runtime-installation-acceptance.json\n.tmp/ci/runtime-installation-acceptance.md\n',
    'include-hidden-files': true, 'if-no-files-found': 'error', 'retention-days': 90 });
  // A separate artifact preserves the receipt download layout and never feeds the gate.
  assert.equal(diagnostic.if, 'failure()');
  assert.equal(diagnostic.run, undefined);
  assert.equal(diagnostic.uses, 'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9');
  assert.deepEqual(diagnostic.with, { name: 'runtime-installation-failure-diagnostics',
    path: '.tmp/published-upgrade/classifarr-upgrade-drill-*/failure.log',
    'include-hidden-files': true, 'if-no-files-found': 'ignore', 'retention-days': 14 });
  assert.ok(!workflow.on.pull_request_target && !workflow.on.workflow_run);
  const acceptance = jobs['release-acceptance'];
  assert.equal(acceptance.steps.length, 5);
  assert.deepEqual(acceptance.needs, ['build-and-test', 'database-tests', 'runtime-installation-acceptance']);
  const download = acceptance.steps.find(step => step.name === 'Download same-run installation receipt');
  assert.equal(download.uses, 'actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333');
  assert.equal(download.if, "needs.runtime-installation-acceptance.result == 'success'");
  assert.deepEqual(download.with, { name: 'runtime-installation-acceptance', path: '.tmp/ci/installation' });
  assert.equal(download.run, undefined);
  assert.equal(download['continue-on-error'], undefined);
  const assemble = acceptance.steps.find(step => step.name === 'Assemble release acceptance readout');
  assert.equal(acceptance.steps[2], download);
  assert.equal(acceptance.steps[3], assemble);
  assert.equal(assemble.if, undefined);
  assert.deepEqual(assemble.env, { CLASSIFARR_INSTALLATION_SOURCE_REVISION: expression('github.sha'),
    CLASSIFARR_INSTALLATION_CANDIDATE_IMAGE_ID: expression('needs.runtime-installation-acceptance.outputs.candidate-image-id') });
  assert.ok(assemble.run.includes(`if [ "${expression('needs.database-tests.result')}" = "success" ] && [ "${expression('needs.runtime-installation-acceptance.result')}" = "success" ] && node scripts/verify-runtime-installation-receipt.mjs; then`));
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
  for (const id of ['docker-release', 'published-digest-consumer-smoke', 'published-routing-acceptance', 'release-candidate-publication', 'release-candidate-provider-fault-receipt', 'promote-published-latest']) {
    assert.equal(jobs[id].if, "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
  }
  assert.equal(jobs['cleanup-old-releases-manual'].if, "github.event_name == 'workflow_dispatch' && inputs.mode == 'cleanup'");
  assert.deepEqual(jobs['cleanup-old-releases'].needs, ['docker-release', 'release-candidate-publication', 'promote-published-latest']);
  assert.equal(jobs['cleanup-old-releases'].if, "startsWith(github.ref, 'refs/tags/v')");
  return true;
}

if (import.meta.main) {
  const workflow = loadWorkflow();
  validateRuntimeInstallationWorkflow(workflow);
  validateDockerHubPullWorkflows(workflow,
    loadWorkflow(resolve(import.meta.dirname, '../../../.github/workflows/resource-capacity.yml')));
  process.stdout.write('Runtime installation acceptance workflow contract passed.\n');
}
