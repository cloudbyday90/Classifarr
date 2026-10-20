/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createVmJobModel } from './gatewayVmJobLifecycle.mjs';
import { VM_JOB_DEADLINES } from './gatewayVmJobContract.mjs';

/** Fictional identities and manually advanced time; never host/guest evidence. */
export function createVmJobSimulation() {
  const binding = { mode: 'simulation', jobId: '019a0000-0000-7000-8000-000000000001',
    ownerToken: '019a0000-0000-7000-8000-000000000002',
    vmId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', configDigest: 'a'.repeat(64) };
  let time = 0, sequence = 0;
  const model = createVmJobModel(binding, { now: () => time });
  return Object.freeze({ binding: Object.freeze(binding), model,
    elapse: milliseconds => { time += milliseconds; },
    step: (kind, details = {}, overrides = {}) => model.advance({
      jobId: binding.jobId, vmId: binding.vmId, configDigest: binding.configDigest, ownerToken: binding.ownerToken,
      sequence: ++sequence, exclusive: true, kind, details,
      bootId: model.snapshot().state === 'inspect' ? null : '11111111-2222-3333-4444-555555555555',
      power: model.snapshot().state === 'inspect' || kind === 'stopped' ? 'Off' : 'Running', ...overrides,
    }),
  });
}

export const simulatedVmDrain = () => ({ admissionsClosed: true, activeJobs: 0,
  ownedResources: 0, workComplete: true, cleanupVerified: true });

export function runVmJobSimulations() {
  const cases = [];
  for (const outcome of ['passed', 'failed', 'cancelled']) {
    const { step, model } = createVmJobSimulation();
    step('inspected'); step('started'); step('ready', { ready: true });
    if (outcome === 'cancelled') model.cancel(); else step('finished', { outcome });
    step('drained', simulatedVmDrain()); step('inspected');
    const result = step('stopped');
    cases.push({ scenario: `${outcome}_job_verified_cleanup`, matched: result.state === 'done' && result.outcome === outcome,
      result });
  }
  const running = createVmJobSimulation();
  const notOwned = running.step('inspected', {}, { power: 'Running' });
  cases.push({ scenario: 'already_running_not_adopted', matched: notOwned.reason === 'initial_vm_not_off', result: notOwned });
  const changed = createVmJobSimulation();
  changed.step('inspected'); changed.step('started'); changed.step('ready', { ready: true });
  changed.step('finished', { outcome: 'passed' }); changed.step('drained', simulatedVmDrain());
  const reboot = changed.step('inspected', {}, { bootId: '22222222-3333-4444-5555-666666666666' });
  cases.push({ scenario: 'reboot_before_shutdown', matched: reboot.reason === 'boot_changed', result: reboot });
  const stalled = createVmJobSimulation();
  stalled.step('inspected'); stalled.step('started'); stalled.model.cancel();
  stalled.step('drained', { ...simulatedVmDrain(), activeJobs: 1 });
  stalled.elapse(VM_JOB_DEADLINES.drain);
  const timeout = stalled.step('drained', simulatedVmDrain());
  cases.push({ scenario: 'drain_timeout_no_force', matched: timeout.reason === 'deadline_or_clock_uncertain', result: timeout });
  return { version: 1, mode: 'simulation', status: cases.every(row => row.matched) ? 'matched' : 'mismatch',
    liveOperationsEnabled: false, studyReady: false, cases };
}
