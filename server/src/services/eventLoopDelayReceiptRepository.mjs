/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

function count(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Stores only a fixed histogram bucket; callers never persist raw timings. */
export async function incrementEventLoopDelayReceipt(db, receipt = {}) {
    await db.query(`
        INSERT INTO event_loop_delay_receipts (
            receipt_version,
            p99_delay_bucket,
            observation_count,
            last_observed_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (receipt_version, p99_delay_bucket)
        DO UPDATE SET
            observation_count = event_loop_delay_receipts.observation_count
                + EXCLUDED.observation_count,
            last_observed_at = NOW()
    `, [
        receipt.version,
        receipt.p99DelayBucket,
        count(receipt.observationCount),
    ]);
}
