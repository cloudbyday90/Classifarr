/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const CATEGORIES = new Set(['deadline', 'connection_lost', 'query_canceled', 'lock_unavailable',
  'permission_denied', 'completion_unverified', 'execution_failed', 'interrupted', 'attempt_limit']);

export const queueVacuumFailureCategory = value => CATEGORIES.has(value) ? value : 'execution_failed';

export function classifyQueueVacuumFailure(error, { timedOut = false, connectionLost = false } = {}) {
  if (timedOut) return 'deadline';
  if (connectionLost) return 'connection_lost';
  if (error?.code === '57014') return 'query_canceled';
  if (error?.code === '55P03') return 'lock_unavailable';
  if (error?.code === '42501') return 'permission_denied';
  if (error?.message === 'queue_vacuum_not_confirmed') return 'completion_unverified';
  return 'execution_failed';
}

/** No raw error, SQL, stack from PostgreSQL, or connection details are retained. */
export class QueueVacuumAttemptError extends Error {
  constructor(category, diagnosis) {
    super('queue_vacuum_attempt_unverified');
    this.name = 'QueueVacuumAttemptError';
    this.category = queueVacuumFailureCategory(category);
    this.diagnosis = diagnosis;
  }
}
