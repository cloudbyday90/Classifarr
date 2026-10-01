/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Pure projection: neither queue state nor elapsed time is a build percentage. */
export function buildImageIndexProgress({ demand, gate, indexes = null, phase = null,
  state = null, task = null, readiness = 'unavailable', observedAt }) {
  const automatic = state ? { started: state.attempts, limit: 3,
    nextEligibleAt: state.next_attempt_at?.toISOString() ?? null } : null;
  const report = (status, reason) => ({ status, reason, observedAt, indexes, automatic });
  if (demand === 'disabled') return report('not_needed', 'disabled');
  if (demand !== 'needed') return report('needs_review', demand);
  if (gate !== 'ready') return report('waiting', 'restore_verification_required');
  if (!indexes) return report('needs_review', 'definition_mismatch');
  if (phase) return report('running', phase);
  if (indexes.every(index => index.status === 'verified')) return report('verified', 'healthy');
  // A live claim may be between DDL statements, including the final allowed attempt.
  if (task?.status === 'processing' && task.live_claim) return report('waiting', 'worker_claimed');
  if (state?.task_id != null && (!task || String(state.task_id) !== String(task.id)
    || !['pending', 'processing'].includes(task.status))) return report('needs_review', 'repair_unverified');
  const autoTask = task?.source === 'image_index_reconciliation';
  if (autoTask && (!state || String(state.task_id) !== String(task.id) || state.attempts >= 3)) return report('needs_review', 'attempt_limit');
  if (readiness === 'unavailable') return report('unavailable', 'observation_failed');
  if (readiness !== 'ready') return report('waiting', readiness);
  if (task?.status === 'processing') return report('waiting', 'claim_recovery');
  if (autoTask && state.next_attempt_at > new Date(observedAt)) return report('waiting', 'cooldown');
  if (task?.next_retry_at > new Date(observedAt)) return report('waiting', 'queue_delay');
  return report('waiting', task ? 'queued' : 'awaiting_check');
}
