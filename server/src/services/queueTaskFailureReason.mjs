/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Queue task state is visible to operators and persisted across restarts.
 * Never place an upstream exception or task payload in that state.
 */

export const QUEUE_TASK_FAILURE_REASON_IDS = Object.freeze({
  PROCESSING_FAILED: 'task_processing_failed',
  UNKNOWN_TASK_TYPE: 'task_unknown_type',
  VISIBILITY_TIMEOUT_RECOVERED: 'task_visibility_timeout_recovered',
  STARTUP_STALE_RECOVERED: 'task_startup_stale_recovered',
  GRACEFUL_SHUTDOWN_RECOVERED: 'task_graceful_shutdown_recovered',
});

export const QUEUE_TASK_RECOVERY_LOG_REASON_IDS = Object.freeze({
  STARTUP_RESET_FAILED: 'task_startup_reset_failed',
  VISIBILITY_RECOVERY_FAILED: 'task_visibility_recovery_failed',
  GRACEFUL_SHUTDOWN_RECOVERY_FAILED: 'task_graceful_shutdown_recovery_failed',
  BACKGROUND_DRAIN_FAILED: 'task_background_drain_failed',
  WORKER_LOOP_FAILED: 'task_worker_loop_failed',
});

export const QUEUE_TASK_LOG_REASON_IDS = Object.freeze({
  ENQUEUE_FAILED: 'task_enqueue_failed',
  ENRICHMENT_STATE_SYNC_FAILED: 'task_enrichment_state_sync_failed',
  DISPATCH_BLOCKER_LOOKUP_FAILED: 'task_dispatch_blocker_lookup_failed',
  DEQUEUE_FAILED: 'task_dequeue_failed',
  COMPLETE_FAILED: 'task_complete_failed',
  STATUS_UPDATE_FAILED: 'task_status_update_failed',
});

const KNOWN_REASON_IDS = new Set(Object.values(QUEUE_TASK_FAILURE_REASON_IDS));

export function normalizeQueueTaskFailureReasonId(value) {
  return KNOWN_REASON_IDS.has(value)
    ? value
    : QUEUE_TASK_FAILURE_REASON_IDS.PROCESSING_FAILED;
}
