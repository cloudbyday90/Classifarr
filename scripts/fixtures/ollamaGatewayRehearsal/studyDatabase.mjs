/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Read-only fixture metadata only. This client is never passed into the runtime ledger. */
export function createStudyDatabaseSample(client) {
  const seen = new Set();
  return async () => {
    const rows = (await client.query(`SELECT pid::text||':'||xact_start::text AS identity,
      greatest(0,extract(epoch FROM clock_timestamp()-xact_start)*1000)::float8 AS age
      FROM pg_stat_activity WHERE datname=current_database() AND application_name='classifarr-gateway-archive-source'
        AND backend_xmin IS NOT NULL AND xact_start IS NOT NULL LIMIT 3`)).rows;
    if (rows.length > 2) throw new Error('study_transaction_count_invalid');
    for (const row of rows) { if (seen.size >= 128 && !seen.has(row.identity)) throw new Error('study_transaction_history_limit'); seen.add(row.identity); }
    return { observedTransactions: seen.size, maxTransactionAgeMs: Math.max(0, ...rows.map(row => row.age)) };
  };
}
