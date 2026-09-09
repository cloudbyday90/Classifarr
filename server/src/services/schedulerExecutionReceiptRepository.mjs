/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const RECEIPT_COLUMNS = Object.freeze([
    'task_class',
    'outcome_id',
    'receipt_version',
    'duration_bucket',
]);

function count(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Stores only fixed aggregate dimensions; callers never persist task or media data. */
export async function incrementSchedulerExecutionReceipt(db, receipt = {}) {
    await db.query(`
        INSERT INTO scheduler_execution_receipts (
            ${RECEIPT_COLUMNS.join(',\n            ')},
            observation_count,
            last_observed_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (${RECEIPT_COLUMNS.join(', ')})
        DO UPDATE SET
            observation_count = scheduler_execution_receipts.observation_count
                + EXCLUDED.observation_count,
            last_observed_at = NOW()
    `, [
        receipt.taskClass,
        receipt.outcomeId,
        receipt.version,
        receipt.durationBucket,
        count(receipt.observationCount),
    ]);
}
