/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const SCHEDULER_EXECUTION_RECEIPT_VERSION = 'scheduler.execution_receipt.v1';

export const SCHEDULER_EXECUTION_OUTCOME_IDS = Object.freeze({
    COMPLETED: 'completed',
    FAILED: 'failed',
    ADVISORY_LOCK_HELD: 'advisory_lock_held',
    IN_PROCESS_OVERLAP: 'in_process_overlap',
    CRON_OVERLAP: 'cron_overlap',
});

export const SCHEDULER_EXECUTION_TASK_CLASS_IDS = Object.freeze({
    QUEUE: 'queue',
    LIBRARY_OBSERVATION: 'library_observation',
    MAINTENANCE: 'maintenance',
    RETENTION: 'retention',
    POLICY_MAINTENANCE: 'policy_maintenance',
    OBSERVATION: 'observation',
    OTHER: 'other',
});

const OUTCOME_IDS = new Set(Object.values(SCHEDULER_EXECUTION_OUTCOME_IDS));
const TASK_CLASS_BY_NAME = Object.freeze({
    'gap-analysis': SCHEDULER_EXECUTION_TASK_CLASS_IDS.QUEUE,
    'retry-queue': SCHEDULER_EXECUTION_TASK_CLASS_IDS.QUEUE,
    'enrichment-retry-queue': SCHEDULER_EXECUTION_TASK_CLASS_IDS.QUEUE,
    'task-queue-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.QUEUE,
    'library-watchdog': SCHEDULER_EXECUTION_TASK_CLASS_IDS.LIBRARY_OBSERVATION,
    'library-sync': SCHEDULER_EXECUTION_TASK_CLASS_IDS.LIBRARY_OBSERVATION,
    'library-observation-history': SCHEDULER_EXECUTION_TASK_CLASS_IDS.LIBRARY_OBSERVATION,
    'rating-normalization-check': SCHEDULER_EXECUTION_TASK_CLASS_IDS.MAINTENANCE,
    'stale-awaiting-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.MAINTENANCE,
    'refresh-token-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'api-key-audit-prune': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'error-log-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'policy-rollback-snapshot-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'web-search-provider-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'policy-observed-evidence-provenance-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'native-intent-reconciliation-ledger-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'native-intent-change-receipt-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'policy-candidate-correction-review-projection-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'policy-candidate-correction-review-corpus-capture-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'policy-change-outcome-observation-retention-cleanup': SCHEDULER_EXECUTION_TASK_CLASS_IDS.RETENTION,
    'native-intent-reconciliation': SCHEDULER_EXECUTION_TASK_CLASS_IDS.POLICY_MAINTENANCE,
    'policy-profile-refresh-outbox': SCHEDULER_EXECUTION_TASK_CLASS_IDS.POLICY_MAINTENANCE,
    'held-out-semantic-study-lifecycle-reaudit': SCHEDULER_EXECUTION_TASK_CLASS_IDS.OBSERVATION,
    'database-health-transition-observation': SCHEDULER_EXECUTION_TASK_CLASS_IDS.OBSERVATION,
});

function durationBucket(durationMs) {
    const duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration < 0) return 'not_sampled';
    if (duration < 5) return 'under_5ms';
    if (duration < 25) return '5_to_24ms';
    if (duration < 100) return '25_to_99ms';
    if (duration < 500) return '100_to_499ms';
    return '500ms_or_more';
}

function isTimedOutcome(outcomeId) {
    return outcomeId === SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED
        || outcomeId === SCHEDULER_EXECUTION_OUTCOME_IDS.FAILED;
}

/**
 * Converts one scheduler outcome into a fixed aggregate. It deliberately omits
 * task names, schedules, error text, SQL, item IDs, libraries, providers,
 * configuration, media, policy values, AI data, decisions, and routing data.
 */
export function buildSchedulerExecutionReceipt({
    taskName,
    outcomeId,
    durationMs = null,
} = {}) {
    if (typeof taskName !== 'string' || taskName.length === 0) {
        throw new TypeError('A scheduler task name is required.');
    }
    if (!OUTCOME_IDS.has(outcomeId)) {
        throw new TypeError('A supported scheduler execution outcome is required.');
    }

    return Object.freeze({
        version: SCHEDULER_EXECUTION_RECEIPT_VERSION,
        taskClass: TASK_CLASS_BY_NAME[taskName] || SCHEDULER_EXECUTION_TASK_CLASS_IDS.OTHER,
        outcomeId,
        durationBucket: isTimedOutcome(outcomeId) ? durationBucket(durationMs) : 'not_sampled',
        observationCount: 1,
    });
}

export function elapsedSchedulerMilliseconds(startedAt, finishedAt = process.hrtime.bigint()) {
    if (typeof startedAt !== 'bigint' || typeof finishedAt !== 'bigint' || finishedAt < startedAt) {
        return null;
    }
    return Number(finishedAt - startedAt) / 1e6;
}

/** Keeps optional receipt collection out of scheduler execution paths. */
export function recordSchedulerExecutionObservation(recorder, observation) {
    if (typeof recorder?.record !== 'function') return null;
    try {
        const result = recorder.record(observation);
        if (typeof result?.catch === 'function') return result.catch(() => null);
        return result;
    } catch (_) {
        return null;
    }
}
