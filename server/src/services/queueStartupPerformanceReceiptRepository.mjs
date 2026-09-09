/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const RECEIPT_COLUMNS = Object.freeze([
    'operation_id',
    'receipt_version',
    'duration_bucket',
    'scanned_id_bucket',
    'candidate_count_bucket',
    'buffer_bucket',
]);

function count(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Stores only fixed aggregate dimensions; callers never supply item or query data. */
export async function incrementQueueStartupPerformanceReceipt(db, receipt = {}) {
    await db.query(`
        INSERT INTO queue_startup_performance_receipts (
            ${RECEIPT_COLUMNS.join(',\n            ')},
            observation_count,
            last_observed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (${RECEIPT_COLUMNS.join(', ')})
        DO UPDATE SET
            observation_count = queue_startup_performance_receipts.observation_count
                + EXCLUDED.observation_count,
            last_observed_at = NOW()
    `, [
        receipt.operationId,
        receipt.version,
        receipt.durationBucket,
        receipt.scannedIdBucket,
        receipt.candidateCountBucket,
        receipt.bufferBucket,
        count(receipt.observationCount),
    ]);
}
