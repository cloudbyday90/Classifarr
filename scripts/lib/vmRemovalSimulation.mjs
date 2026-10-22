/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createVmRemovalErrorReport, appendVmRemovalSecondary } from './vmRemovalErrorContract.mjs';
import { createVmRemovalMemoryJournal, defaultVmRemovalJournalOptions } from './vmRemovalMemoryJournal.mjs';
import { createVmRemovalMockOperations } from './vmRemovalMockOperations.mjs';
import { simulationPhases, requireVmRemovalScenario, successfulVmRemovalScenario,
  stopSimulation, SimulationStop, unavailableSimulationError, frozenSimulationCopy,
  invalidSimulation, vmRemovalSimulationLimits as limits } from './vmRemovalSimulationContract.mjs';

/** Disabled runner: only finite mock data and a memory journal, never callbacks or native resources. */
export function createVmRemovalSimulation(journalOptions = defaultVmRemovalJournalOptions()) {
  const journal = createVmRemovalMemoryJournal(journalOptions), operations = createVmRemovalMockOperations();
  const completed = [], claimed = new Set();
  let halted = false, reason = null, phase = null, step = null, vmState = 'not_requested';
  let diskReturned = null, vmReturned = null, diskRecorded = null, vmRecorded = null;
  let errors = createVmRemovalErrorReport();
  const snapshot = () => {
    const output = { version: 1, mode: 'simulation', status: halted ? 'stopped' : completed.length ? 'phase_complete' : 'idle',
      phase, step, reason, completed: [...completed], simulatedVmState: vmState,
      simulatedIdentity: { diskReturned, vmReturned, diskRecorded, vmRecorded },
      simulatedPayloadCleanupAttempted: false, cleanupComplete: false, nativeMutationAttempted: false,
      liveOperationsEnabled: false, retryAllowed: false, rootCauseConfirmed: false, studyReady: false,
      journal: journal.snapshot(), operations: operations.snapshot(),
      errors: { primary: errors.primary, secondary: errors.secondary, secondaryTruncated: errors.secondaryTruncated } };
    if (Buffer.byteLength(JSON.stringify(output)) > limits.outputBytes) return invalidSimulation();
    return frozenSimulationCopy(output);
  };
  const record = (kind, at, identity = null, failure = null) => journal.append(phase, kind, at, identity, failure);
  function observe(at, scenario, present = true) {
    step = at;
    operations.observe(at, scenario, present, diskRecorded ?? 201, vmRecorded ?? 201);
  }
  function configured(scenario) {
    if (scenario.observedDisk !== diskRecorded || scenario.observedVm !== vmRecorded) return stopSimulation('identity_changed', step);
    if (!scenario.off || !scenario.disconnected || !scenario.startupDisabled || scenario.checkpoints !== 0
      || !scenario.diskUnchanged || !scenario.treeUnchanged) return stopSimulation('configuration_unconfirmed', step);
  }
  function effect(at, scenario) {
    step = at; record('intent', at);
    if (at === 'create_vm' || at === 'configure_vm' || at === 'remove_vm') vmState = 'unconfirmed';
    operations.call(at, scenario);
  }
  function create(scenario) {
    observe('observe_initial', scenario, false);
    if (scenario.inventory.length >= limits.vms) return stopSimulation('inventory_limit', step);
    if (!scenario.nameAbsent || !scenario.rootAbsent) return stopSimulation('collision', step);
    effect('create_disk', scenario); diskReturned = scenario.returnedDisk || null;
    if (!diskReturned) return stopSimulation('created_identity_missing', step);
    record('identity', 'create_disk', diskReturned); diskRecorded = diskReturned;
    // Disk path/reference collisions use the returned identity as well as the proposed synthetic one.
    if (scenario.inventory.some(row => row.disks.includes(diskRecorded))) return stopSimulation('foreign_reference', step);
    effect('create_vm', scenario); vmReturned = scenario.returnedVm || null;
    if (!vmReturned || scenario.inventory.some(row => row.id === vmReturned)) return stopSimulation('created_identity_missing', step);
    record('identity', 'create_vm', vmReturned); vmRecorded = vmReturned;
    effect('configure_vm', scenario);
    observe('observe_created', scenario); configured(scenario);
    record('complete', step); vmState = 'verified_off';
  }
  function inspect(scenario) {
    observe('observe_inspect', scenario); configured(scenario);
    record('complete', 'admission'); vmState = 'verified_off';
  }
  function remove(scenario) {
    observe('observe_remove', scenario); configured(scenario);
    step = 'remove_vm'; record('intent', step);
    observe('observe_remove_final', scenario); configured(scenario);
    step = 'remove_vm'; vmState = 'unconfirmed'; operations.call(step, scenario);
    observe('observe_absence', scenario, false);
    if (!scenario.vmAbsent || !scenario.diskUnchanged || !scenario.treeUnchanged
      || scenario.inventory.some(row => row.id === vmRecorded)) return stopSimulation('absence_unconfirmed', step);
    record('complete', step); vmState = 'verified_absent';
  }
  function capture(failure, allowJournal) {
    halted = true;
    const known = failure instanceof SimulationStop ? failure : new SimulationStop('internal_failure', step);
    if (reason === null) {
      reason = known.reason; step = known.step;
      // The projector report is used only for its global error budget; its remove_vm label is not emitted.
      errors = createVmRemovalErrorReport(known.detail);
      if (known.projectionFailed) errors = appendVmRemovalSecondary(errors, 'projection', unavailableSimulationError());
      if (allowJournal && !journal.snapshot().poisoned) {
        try { record('failure', step, null, errors.primary); }
        catch (secondary) { errors = appendVmRemovalSecondary(errors, 'journal',
          secondary instanceof SimulationStop ? secondary.detail : unavailableSimulationError()); }
      }
    } else {
      errors = appendVmRemovalSecondary(errors, 'dispose', known.detail);
      if (known.projectionFailed) errors = appendVmRemovalSecondary(errors, 'projection', unavailableSimulationError());
    }
  }
  function runPhase(next, input = successfulVmRemovalScenario()) {
    if (!simulationPhases.includes(next)) return invalidSimulation();
    if (halted) return snapshot();
    const scenario = requireVmRemovalScenario(input);
    phase = next;
    if (claimed.has(next) || simulationPhases[completed.length] !== next) {
      capture(new SimulationStop('phase_order_or_prior_attempt', 'admission'), false); return snapshot();
    }
    claimed.add(next); let disposalRequired = false;
    try {
      step = 'journal'; record('claim', step); disposalRequired = true;
      ({ create, inspect, remove })[next](scenario);
      completed.push(next);
    } catch (failure) { capture(failure, true); }
    // No cleanup in finally: disposal is a separate mock call and can only stop later work.
    if (disposalRequired) {
      try { operations.call('dispose', scenario); }
      catch (failure) { capture(failure, false); }
    }
    return snapshot();
  }
  // Each view shares admission and history; no caller can supply a replacement adapter or journal.
  const runner = () => Object.freeze({ runPhase, snapshot });
  return Object.freeze({ runner, snapshot });
}
