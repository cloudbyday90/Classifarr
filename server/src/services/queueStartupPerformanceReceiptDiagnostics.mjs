/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const CONNECTION_CODES = new Set(['08000', '08003', '08006', '57P01', '57P02', '57P03',
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE']);
const DATABASE_CODES = new Set(['42501', '42P01', '23514', '22003', '53300', '57014']);

/** Fixed categories only: never attach arbitrary exceptions, SQL or configuration. */
export function warnQueueStartupPerformanceReceiptFailure(logger, error) {
    try {
        // Read once before validation so even an accessor cannot swap in raw text.
        const suppliedCode = error?.code;
        const connectionFailure = CONNECTION_CODES.has(suppliedCode);
        const databaseFailure = DATABASE_CODES.has(suppliedCode);
        let errorCategory = 'unknown';
        if (error?.message === 'database_lock_scope_closed') errorCategory = 'ownership_scope_closed';
        else if (connectionFailure) errorCategory = 'connection_unavailable';
        else if (databaseFailure) errorCategory = 'database_rejected';
        const code = connectionFailure || databaseFailure ? suppliedCode : undefined;
        // Logging is optional too. Do not wait for it, recurse into DB logging, or leak a rejection.
        void Promise.resolve(logger.warn('Queue startup performance receipt persistence failed', {
            reasonCode: 'queue_startup_performance_receipt_persistence_failed',
            errorCategory,
            ...(code ? { code } : {}),
        }, { skipDbPersist: true })).catch(() => {}); // swallow-error: logging an optional logger failure would recurse; queue work must remain independent.
    } catch (_) { /* Even a broken logger must not fail the queue or its timer. */ }
}
