/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { reportSnapshot } from './archiveRepository.mjs';
import { captureArchiveContent } from './archiveContent.mjs';
import { createArchiveDirectory, finishArchive } from './archiveFiles.mjs';
import { dumpGatewayArchive } from './archiveDump.mjs';
import { gatewayError } from './errors.mjs';

export async function withOnlineArchiveSnapshot(client, configuration, consume, signal) {
  try {
    signal?.throwIfAborted();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='75s'");
    await client.query("SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    const report = await reportSnapshot(client, configuration.providerHash, configuration.retentionDays);
    if (!report.counterMatches || report.legacyActiveWithoutBinding) throw gatewayError('gateway_archive_source_inconsistent');
    const admission = (await client.query('SELECT to_jsonb(a)::text AS row FROM ollama_gateway.admission a')).rows[0].row;
    const revision = createHash('sha256').update(admission).update(JSON.stringify(report.counts)).digest('hex');
    const result = await consume({ report, revision });
    signal?.throwIfAborted(); await client.query('COMMIT'); return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Dedicated session is discarded by the caller. */ }
    throw error;
  }
}

export async function createOnlineArchive(client, configuration, parent, job, predecessors, signal) {
  let directory;
  const manifest = await withOnlineArchiveSnapshot(client, configuration, async ({ report, revision }) => {
    if (report.ledgerId !== job.ledger_id || revision !== job.revision) throw gatewayError('gateway_archive_source_changed');
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const content = await captureArchiveContent(client, signal);
    directory = await createArchiveDirectory(parent, job.id);
    const dump = await dumpGatewayArchive(configuration, snapshot, directory, signal);
    return { version: 3, schemaVersion: 7, archiveId: job.id, report, revision, policyHash: job.policy_hash, content, predecessors, dump };
  }, signal);
  const result = await finishArchive(directory, manifest);
  return { ...result, manifest };
}
