/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveRevision } from './archiveRevision.mjs';
import { reportSnapshot } from './archiveRepository.mjs';
import { gatewayError } from './errors.mjs';

const active = new WeakMap();
const sessions = new WeakSet();

export function assertArchiveSnapshot(client, context) {
  if (!context || active.get(context) !== client) throw gatewayError('gateway_archive_snapshot_invalid');
}

/** A capability belongs to one live read transaction, not a transferable snapshot name. */
export async function withOnlineArchiveSnapshot(client, configuration, consume, signal, previousRevisions = []) {
  if (sessions.has(client)) throw gatewayError('gateway_archive_snapshot_invalid');
  sessions.add(client);
  let context;
  try {
    signal?.throwIfAborted();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='75s'");
    await client.query("SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    const report = await reportSnapshot(client, configuration.providerHash, configuration.retentionDays);
    if (!report.counterMatches || report.legacyActiveWithoutBinding) throw gatewayError('gateway_archive_source_inconsistent');
    const admission = (await client.query('SELECT to_jsonb(a)::text AS row FROM ollama_gateway.admission a')).rows[0].row;
    context = Object.freeze({ report, ...archiveRevision(admission, report.counts, previousRevisions) });
    active.set(context, client);
    const result = await consume(context);
    signal?.throwIfAborted(); await client.query('COMMIT'); return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Caller discards the dedicated session. */ }
    throw error;
  } finally { if (context) active.delete(context); sessions.delete(client); }
}
