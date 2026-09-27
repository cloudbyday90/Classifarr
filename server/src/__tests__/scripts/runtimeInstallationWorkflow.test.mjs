/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { loadWorkflow } from '../../scripts/checkReleaseCandidatePublicationWorkflow.mjs';
import { validateRuntimeInstallationWorkflow } from '../../scripts/checkRuntimeInstallationWorkflow.mjs';

test('checked-in CI requires isolated installation acceptance before publication', () => {
  expect(validateRuntimeInstallationWorkflow(loadWorkflow())).toBe(true);
});
test.each([
  ['write permission', w => { w.jobs['runtime-installation-acceptance'].permissions.contents = 'write'; }],
  ['skip job', w => { w.jobs['runtime-installation-acceptance'].if = 'false'; }],
  ['mask job failure', w => { w.jobs['runtime-installation-acceptance']['continue-on-error'] = true; }],
  ['mask scenario failure', w => { w.jobs['runtime-installation-acceptance'].steps[2]['continue-on-error'] = true; }],
  ['skip scenario', w => { w.jobs['runtime-installation-acceptance'].steps[2].if = 'false'; }],
  ['upload raw data', w => { w.jobs['runtime-installation-acceptance'].steps[3].with.path = '.tmp/**'; }],
  ['lose failure evidence', w => { delete w.jobs['runtime-installation-acceptance'].steps[3].if; }],
  ['mutable action', w => { w.jobs['runtime-installation-acceptance'].steps[0].uses = 'actions/checkout@main'; }],
  ['untrusted privileged trigger', w => { w.on.pull_request_target = {}; }],
  ['bypass acceptance dependency', w => { w.jobs['release-acceptance'].needs.pop(); }],
  ['bypass installation result', w => { w.jobs['release-acceptance'].steps[2].run = 'echo passed'; }],
  ['bypass publishing gate', w => { w.jobs['docker-release'].needs = ['build-and-test']; }],
])('rejects %s', (_name, mutate) => {
  const workflow = loadWorkflow();
  mutate(workflow);
  expect(() => validateRuntimeInstallationWorkflow(workflow)).toThrow();
});
