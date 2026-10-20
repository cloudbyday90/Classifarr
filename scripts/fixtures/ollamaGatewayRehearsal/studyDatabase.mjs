/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Read-only fixture metadata only. This client is never passed into the runtime ledger. */
const applications = Object.freeze({
  'classifarr-gateway-archive-source':'archiveSourceConnections',
  'classifarr-gateway-archive-coordinator':'coordinatorConnections',
  'classifarr-gateway-catalog-snapshot':'catalogSnapshotConnections',
});

export function createStudyDatabaseSample(client) {
  const seen = new Set(), catalog = new Set();
  return async () => {
    const rows = (await client.query(`SELECT application_name AS application,pid::text AS connection,
      CASE WHEN backend_xmin IS NOT NULL AND xact_start IS NOT NULL THEN pid::text||':'||xact_start::text END AS identity,
      CASE WHEN backend_xmin IS NOT NULL AND xact_start IS NOT NULL THEN
        greatest(0,extract(epoch FROM clock_timestamp()-xact_start)*1000)::float8 END AS age
      FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend'
        AND application_name=ANY($1::text[]) LIMIT 6`,[Object.keys(applications)])).rows;
    if (!Array.isArray(rows) || rows.length > 4) throw new Error('study_connection_count_invalid');
    const sample = {managedConnections:rows.length,archiveSourceConnections:0,coordinatorConnections:0,
      catalogSnapshotConnections:0,catalogSnapshotTransactions:0,maxTransactionAgeMs:0,maxCatalogTransactionAgeMs:0};
    const connections = new Set(), identities = [];
    for (const row of rows) {
      if (!Object.hasOwn(applications,row.application) || typeof row.connection !== 'string' || !/^[1-9][0-9]{0,9}$/.test(row.connection) ||
          connections.has(row.connection) || (row.identity === null ? row.age !== null :
            typeof row.identity !== 'string' || row.identity.length > 128 || !row.identity.startsWith(`${row.connection}:`) ||
            !Number.isFinite(row.age) || row.age < 0)) throw new Error('study_transaction_invalid');
      connections.add(row.connection); sample[applications[row.application]]++;
      // Coordinator autocommit activity is not an archive read snapshot.
      if (row.identity === null || row.application === 'classifarr-gateway-archive-coordinator') continue;
      const key = `${row.application}:${row.identity}`; identities.push({key,owner:row.application === 'classifarr-gateway-catalog-snapshot'});
      sample.maxTransactionAgeMs = Math.max(sample.maxTransactionAgeMs,row.age);
      if (row.application === 'classifarr-gateway-catalog-snapshot') {
        sample.catalogSnapshotTransactions++; sample.maxCatalogTransactionAgeMs = Math.max(sample.maxCatalogTransactionAgeMs,row.age);
      }
    }
    if (sample.archiveSourceConnections > 2 || sample.coordinatorConnections > 1 || sample.catalogSnapshotConnections > 1) throw new Error('study_connection_count_invalid');
    // Validate the complete sample before extending either bounded cumulative set.
    const added = new Set(identities.map(value=>value.key).filter(key=>!seen.has(key)));
    if (seen.size + added.size > 128) throw new Error('study_transaction_history_limit');
    for (const {key,owner} of identities) { seen.add(key); if (owner) catalog.add(key); }
    return {...sample,observedTransactions:seen.size,observedCatalogTransactions:catalog.size};
  };
}

export function requireStudyDatabaseCoverage(summary) {
  const fields = ['managedConnections','archiveSourceConnections','coordinatorConnections','catalogSnapshotConnections',
    'catalogSnapshotTransactions','maxTransactionAgeMs','maxCatalogTransactionAgeMs','observedTransactions','observedCatalogTransactions'];
  if (!Number.isInteger(summary?.samples) || summary.samples < 1 || !summary.coverage || !summary.peaks ||
      fields.some(key=>!Number.isInteger(summary.coverage[key]) || summary.coverage[key] < summary.samples * 0.9 || summary.coverage[key] > summary.samples) ||
      !Number.isInteger(summary.peaks.observedTransactions) || summary.peaks.observedTransactions < 4 || summary.peaks.observedTransactions > 128 ||
      !Number.isInteger(summary.peaks.observedCatalogTransactions) || summary.peaks.observedCatalogTransactions < 2 ||
      summary.peaks.observedCatalogTransactions > summary.peaks.observedTransactions ||
      summary.peaks.catalogSnapshotConnections !== 1 || !Array.isArray(summary.bins)) throw new Error('study_database_coverage');
  const idle = summary.bins.filter(bin=>bin.phase === 'idle');
  for (const field of ['managedConnections','catalogSnapshotConnections']) {
    if (idle.reduce((sum,bin)=>sum+(bin.values[field]?.count ?? 0),0) < 45 ||
        idle.some(bin=>!bin.values[field] || bin.values[field].max !== 0)) throw new Error('study_database_idle_connections');
  }
  return summary;
}
