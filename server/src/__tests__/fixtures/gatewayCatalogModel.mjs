/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

// Executable specification ONLY: no database, provider, scheduler or production
// imports. Logical generations are abstractions, not a new persistence format.
export function catalogModel() {
  return { clock: 0, history: 1, maintenance: [], generation: 0, jobs: [], enabled: true,
    bindings: 1, consistent: true, sameIdentity: true, runtimeEnabled: false };
}

export function catalogModelDue(state, secondCopy = false) {
  if (!state.enabled) return 'disabled';
  if (!state.consistent) return 'source_inconsistent';
  if (!state.bindings) return 'empty';
  if (state.jobs.some(job => ['exporting', 'awaiting_verification', 'interrupted'].includes(job.status))) return 'pending';
  if (!state.sameIdentity) return 'identity_changed';
  const attempts = state.jobs.filter(job => job.history === state.history);
  const successes = state.jobs.filter(job => ['verified', 'retired'].includes(job.status));
  if (!secondCopy && successes.some(job => job.history === state.history && job.snapshot?.generation === state.generation)) return 'unchanged';
  // Maintenance churn and verification-run identity NEVER mint a fresh budget.
  if (Math.max(attempts.length, ...attempts.map(job => job.attempt), 0) >= 3) return 'attempts_exhausted';
  if (attempts.some(job => job.retryAfter > state.clock)) return 'cooldown';
  const last = Math.max(...successes.map(job => job.completedAt), -Infinity);
  const retry = attempts.some(job => job.status === 'failed');
  const interval = state.bindings >= 80000 ? 3600000 : 86400000;
  if (!retry && !secondCopy && state.clock - last < interval) return 'not_due';
  return 'due';
}

/** Invalid/delayed transitions are rejected atomically, without rewriting intent. */
export function catalogModelStep(previous, event) {
  const state = structuredClone(previous), job = state.jobs.find(item => item.id === event.id);
  const fail = reason => {
    assert.ok(['exporting', 'awaiting_verification'].includes(job?.status));
    Object.assign(job, { status: 'failed', reason, completedAt: state.clock,
      retryAfter: state.clock + (job.attempt === 1 ? 300000 : 1800000) });
  };
  switch (event.type) {
    case 'admit': {
      assert.equal(catalogModelDue(state, event.secondCopy), 'due');
      assert.match(event.id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      assert.ok(!job && state.jobs.length < 32);
      const attempts = state.jobs.filter(item => item.history === state.history);
      state.jobs.push({ id: event.id, history: state.history, attempt: Math.max(attempts.length, ...attempts.map(item => item.attempt), 0) + 1,
        status: 'exporting', snapshot: null, manifest: null, retryAfter: null });
      break;
    }
    case 'snapshot':
      assert.equal(job?.status, 'exporting'); assert.equal(job.history, state.history); assert.equal(job.snapshot, null);
      // Capture AFTER admission. The own job is unfinished; future receipts do not
      // get written back into this historical view. Existing snapshots are opaque
      // references here, not recursively embedded bundles.
      job.snapshot = { generation: state.generation, maintenance: structuredClone(state.maintenance),
        jobs: state.jobs.map(({ snapshot: _snapshot, ...row }) => row) };
      break;
    case 'publish':
      assert.equal(job?.status, 'exporting'); assert.ok(job.snapshot);
      assert.match(event.manifest, /^[a-f0-9]{64}$/);
      Object.assign(job, { status: 'awaiting_verification', manifest: event.manifest });
      break;
    case 'receipt':
      assert.ok(job);
      assert.equal(event.manifest, job?.manifest); assert.ok(typeof event.verified === 'boolean');
      if (job.status === 'verified' && event.verified) break;
      assert.equal(job.status, 'awaiting_verification');
      if (event.verified) Object.assign(job, { status: 'verified', completedAt: state.clock });
      else fail('verification_failed');
      break;
    case 'fail':
      assert.ok(['export_failed', 'cancelled'].includes(event.reason)); fail(event.reason); break;
    case 'restart':
      for (const item of state.jobs) if (item.status === 'exporting') item.status = 'interrupted';
      break;
    case 'maintenance':
      assert.ok(['protection', 'cleanup_attempt', 'cleanup_confirmation', 'retirement'].includes(event.kind));
      assert.ok(state.maintenance.length < 32);
      // Only independent source mutations enter this list. A later production
      // implementation must prove this causal distinction with durable evidence.
      state.maintenance.push({ kind: event.kind, value: event.value }); state.generation++; break;
    case 'history': state.history++; break;
    case 'tick':
      assert.ok(Number.isSafeInteger(event.ms) && event.ms >= 0 && Number.isSafeInteger(state.clock + event.ms));
      state.clock += event.ms; break;
    case 'restore':
      // A historical copy never authorizes replay, confirmation, budget reset or
      // activation. Real restoration is an independent acceptance gate.
      state.enabled = false; state.runtimeEnabled = false; break;
    default: assert.fail('unknown_model_event');
  }
  return state;
}
