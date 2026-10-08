/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { loadWorkflow } from '../../scripts/checkReleaseCandidatePublicationWorkflow.mjs';
import { validateRuntimeInstallationWorkflow } from '../../scripts/checkRuntimeInstallationWorkflow.mjs';

test('checked-in CI requires isolated installation acceptance before publication', () => {
  expect(validateRuntimeInstallationWorkflow(loadWorkflow())).toBe(true);
});

test.each([
  ['runtime-installation-acceptance', 1, 'setup-node', '820762786026740c76f36085b0efc47a31fe5020', 'v7'],
  ['runtime-installation-acceptance', 4, 'upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a', 'v7'],
  ['runtime-installation-acceptance', 5, 'upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a', 'v7'],
  ['release-acceptance', 2, 'download-artifact', '3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c', 'v8'],
].flatMap(([job, step, action, stale, tag]) => [stale, tag, 'main', undefined]
  .map(ref => [job, step, action, ref])))('rejects unreviewed %s step %i (%s@%s)', (job, step, action, ref) => {
  const workflow = loadWorkflow();
  workflow.jobs[job].steps[step].uses = ref ? `actions/${action}@${ref}` : undefined;
  expect(() => validateRuntimeInstallationWorkflow(workflow)).toThrow();
});

test.each([
  ['write permission', w => { w.jobs['runtime-installation-acceptance'].permissions.contents = 'write'; }],
  ['skip job', w => { w.jobs['runtime-installation-acceptance'].if = 'false'; }],
  ['mask job failure', w => { w.jobs['runtime-installation-acceptance']['continue-on-error'] = true; }],
  ['mask scenario failure', w => { w.jobs['runtime-installation-acceptance'].steps[2]['continue-on-error'] = true; }],
  ['skip scenario', w => { w.jobs['runtime-installation-acceptance'].steps[2].if = 'false'; }],
  ['upload raw data', w => { w.jobs['runtime-installation-acceptance'].steps[4].with.path = '.tmp/**'; }],
  ['lose failure evidence', w => { delete w.jobs['runtime-installation-acceptance'].steps[4].if; }],
  ['omit hidden receipt files', w => { delete w.jobs['runtime-installation-acceptance'].steps[4].with['include-hidden-files']; }],
  ['omit failure diagnostic artifact', w => { w.jobs['runtime-installation-acceptance'].steps.pop(); }],
  ['upload private diagnostics', w => { w.jobs['runtime-installation-acceptance'].steps[5].with.path = '.tmp/**'; }],
  ['upload diagnostics on success', w => { w.jobs['runtime-installation-acceptance'].steps[5].if = 'always()'; }],
  ['retain diagnostics indefinitely', w => { w.jobs['runtime-installation-acceptance'].steps[5].with['retention-days'] = 90; }],
  ['mutable action', w => { w.jobs['runtime-installation-acceptance'].steps[0].uses = 'actions/checkout@main'; }],
  ['untrusted privileged trigger', w => { w.on.pull_request_target = {}; }],
  ['bypass acceptance dependency', w => { w.jobs['release-acceptance'].needs.pop(); }],
  ['bypass installation result', w => { w.jobs['release-acceptance'].steps[3].run = 'echo passed'; }],
  ['omit baseline history', w => { delete w.jobs['runtime-installation-acceptance'].steps[0].with['fetch-depth']; }],
  ['wrong candidate output', w => { w.jobs['runtime-installation-acceptance'].outputs['candidate-image-id'] = 'latest'; }],
  ['different run artifact', w => { w.jobs['release-acceptance'].steps[2].with['run-id'] = '123'; }],
  ['wrong artifact', w => { w.jobs['release-acceptance'].steps[2].with.name = 'other'; }],
  ['skip receipt download', w => { w.jobs['release-acceptance'].steps[2].if = 'false'; }],
  ['mask receipt download', w => { w.jobs['release-acceptance'].steps[2]['continue-on-error'] = true; }],
  ['skip receipt verification', w => { const s = w.jobs['release-acceptance'].steps[3]; s.run = s.run.replace(' && node scripts/verify-runtime-installation-receipt.mjs', ''); }],
  ['skip readout', w => { w.jobs['release-acceptance'].steps[3].if = 'false'; }],
  ['validate before download', w => { w.jobs['release-acceptance'].steps.splice(2, 2, ...w.jobs['release-acceptance'].steps.slice(2, 4).reverse()); }],
  ['wrong expected image', w => { w.jobs['release-acceptance'].steps[3].env.CLASSIFARR_INSTALLATION_CANDIDATE_IMAGE_ID = 'latest'; }],
  ['bypass publishing gate', w => { w.jobs['docker-release'].needs = ['build-and-test']; }],
  ['remove budget mode', w => { w.on.workflow_dispatch.inputs.mode.options.pop(); }],
  ['allow arbitrary mode', w => { w.on.workflow_dispatch.inputs.mode.type = 'string'; }],
  ['default to budget mode', w => { w.on.workflow_dispatch.inputs.mode.default = 'installation-budget'; }],
  ['run both installation profiles', w => { delete w.jobs['runtime-installation-acceptance'].steps[2].if; }],
  ['run budget on every push', w => { delete w.jobs['runtime-installation-acceptance'].steps[3].if; }],
  ['skip budget proof', w => { w.jobs['runtime-installation-acceptance'].steps[3].run = 'node scripts/run-runtime-installation-acceptance.mjs --ci'; }],
  ['interpolate dispatch in shell', w => { w.jobs['runtime-installation-acceptance'].steps[3].run += ' $' + '{{ inputs.mode }}'; }],
  ['mask budget failure', w => { w.jobs['runtime-installation-acceptance'].steps[3]['continue-on-error'] = true; }],
  ['missing verifier token', w => { delete w.jobs['runtime-installation-acceptance'].steps[3].env.GH_TOKEN; }],
  ['unbound source revision', w => { delete w.jobs['runtime-installation-acceptance'].steps[3].env.CLASSIFARR_INSTALLATION_SOURCE_REVISION; }],
  ['dispatch image publication', w => { w.jobs['docker-release'].if = 'always()'; }],
  ['dispatch release creation', w => { w.jobs['release-candidate-publication'].if = 'always()'; }],
  ['dispatch tag cleanup', w => { w.jobs['cleanup-old-releases-manual'].if = "github.event_name == 'workflow_dispatch'"; }],
  ['bypass automatic cleanup dependencies', w => { w.jobs['cleanup-old-releases'].needs = []; }],
  ['run full build on budget dispatch', w => { w.jobs['build-and-test'].if = 'always()'; }],
  ['run database gate on budget dispatch', w => { w.jobs['database-tests'].if = 'always()'; }],
  ['treat budget dispatch as release acceptance', w => { w.jobs['release-acceptance'].if = 'always()'; }],
])('rejects %s', (_name, mutate) => {
  const workflow = loadWorkflow();
  mutate(workflow);
  expect(() => validateRuntimeInstallationWorkflow(workflow)).toThrow();
});
