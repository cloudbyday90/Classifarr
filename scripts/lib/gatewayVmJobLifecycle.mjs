/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { isVmGuid } from './gatewayVmPreparation.mjs';
import { exactVmKeys, matchesVmJobObservation, requireVmJobBinding,
  VM_JOB_DEADLINES, VM_JOB_MAX_OBSERVATIONS } from './gatewayVmJobContract.mjs';

/** Simulation-only decisions. No adapter, power commands, SSH or imported receipts. */
export function createVmJobModel(input, { now = () => performance.now() } = {}) {
  const binding = requireVmJobBinding(input);
  let state = 'inspect', outcome = null, reason = null, decision = 'await_observation';
  let bootId = null, sequence = 0, observations = 0, lastTime = now(), since = lastTime;
  let cancelled = false;
  if (!Number.isFinite(lastTime) || lastTime < 0) throw new Error('gateway_vm_job_clock_invalid');
  const result = () => Object.freeze({ version: 1, mode: 'simulation', state, outcome, reason, decision,
    liveOperationsEnabled: false, studyReady: false });
  const hold = code => { state = 'held'; reason = code; decision = 'leave_power_unchanged'; return result(); };
  const move = (next, action) => { state = next; since = lastTime; decision = action; return result(); };
  const active = () => state !== 'done' && state !== 'held';
  function checkTime() {
    let time;
    try { time = now(); } catch { return false; }
    if (!Number.isFinite(time) || time < lastTime || time - since >= VM_JOB_DEADLINES[state]) return false;
    lastTime = time; return true;
  }
  function advance(value) {
    if (!active()) return result();
    decision = 'await_observation';
    if (!checkTime()) return hold('deadline_or_clock_uncertain');
    if (++observations > VM_JOB_MAX_OBSERVATIONS) return hold('observation_limit');
    if (!matchesVmJobObservation(value, binding, sequence)) return hold('observation_or_ownership_uncertain');
    sequence = value.sequence;
    if (state !== 'inspect' && state !== 'starting' && value.bootId !== bootId) return hold('boot_changed');
    const { kind, details, power } = value;
    if (state === 'inspect') {
      if (kind !== 'inspected' || !exactVmKeys(details, '') || value.bootId !== null) return hold('initial_observation_invalid');
      if (power !== 'Off') return hold('initial_vm_not_off');
      return move('starting', 'would_start_owned_vm');
    }
    if (state === 'starting') {
      if (kind !== 'started' || !exactVmKeys(details, '') || power !== 'Running' || !isVmGuid(value.bootId)) return hold('startup_uncertain');
      bootId = value.bootId;
      return cancelled ? move('drain', 'would_close_admission_and_drain') : move('readiness', 'await_readiness');
    }
    if (state !== 'stopping' && power !== 'Running') return hold('power_changed');
    if (state === 'readiness') {
      if (kind !== 'ready' || !exactVmKeys(details, 'ready') || typeof details.ready !== 'boolean') return hold('readiness_uncertain');
      return details.ready ? move('work', 'would_run_requested_job') : result();
    }
    if (state === 'work') {
      if (kind !== 'finished' || !exactVmKeys(details, 'outcome') || !['passed', 'failed', 'cancelled'].includes(details.outcome)) return hold('job_completion_uncertain');
      outcome = details.outcome;
      return move('drain', 'would_close_admission_and_drain');
    }
    if (state === 'drain') {
      if (kind !== 'drained' || !exactVmKeys(details, 'admissionsClosed activeJobs ownedResources workComplete cleanupVerified')
        || !['admissionsClosed', 'workComplete', 'cleanupVerified'].every(key => typeof details[key] === 'boolean')
        || !['activeJobs', 'ownedResources'].every(key => Number.isSafeInteger(details[key]) && details[key] >= 0)) return hold('cleanup_uncertain');
      if (!details.admissionsClosed || !details.workComplete || !details.cleanupVerified
        || details.activeJobs !== 0 || details.ownedResources !== 0) {
        decision = 'await_verified_drain'; return result();
      }
      return move('confirm', 'await_final_identity_check');
    }
    if (state === 'confirm') {
      if (kind !== 'inspected' || !exactVmKeys(details, '')) return hold('final_identity_uncertain');
      return move('stopping', 'would_request_graceful_shutdown');
    }
    if (kind !== 'stopped' || !exactVmKeys(details, '') || power !== 'Off') return hold('shutdown_unconfirmed');
    return move('done', 'off_confirmed');
  }
  function cancel() {
    if (!active()) return result();
    decision = 'await_observation';
    if (!checkTime()) return hold('deadline_or_clock_uncertain');
    // Repeated cancellation cannot extend a deadline or overwrite job results.
    if (cancelled) return result();
    cancelled = true;
    if (outcome === null) outcome = 'cancelled';
    if (state === 'inspect') return move('done', 'leave_power_unchanged');
    if (state === 'readiness' || state === 'work') return move('drain', 'would_close_admission_and_drain');
    return result();
  }
  return Object.freeze({ advance, cancel, snapshot: result });
}
