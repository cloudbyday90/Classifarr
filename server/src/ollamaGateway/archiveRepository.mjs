/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { validateArchiveReport } from './archiveContract.mjs';
import { archiveCategorySql } from './archiveRetentionQueries.mjs';

async function reportSnapshot(client, providerHash, retentionDays) {
  const result = await client.query(`SELECT id,provider_hash,attempts::text,binding_count,active_request,
    clock_timestamp() AS captured_at,clock_timestamp()-make_interval(days=>$2::int) AS cutoff
    FROM ollama_gateway.admission WHERE singleton AND version=7 AND provider_hash=$1`, [providerHash, retentionDays]);
  if (result.rowCount !== 1) throw gatewayError('gateway_archive_ledger_unavailable');
  const row = result.rows[0];
  const countRows = await client.query(`SELECT 'admission' AS name,count(*)::int AS n FROM ollama_gateway.admission
    UNION ALL SELECT 'request_binding',count(*)::int FROM ollama_gateway.request_binding
    UNION ALL SELECT 'completion_receipt',count(*)::int FROM ollama_gateway.completion_receipt
    UNION ALL SELECT 'recovery_receipt',count(*)::int FROM ollama_gateway.recovery_receipt
    UNION ALL SELECT 'provider_stop_intent',count(*)::int FROM ollama_gateway.provider_stop_intent
    UNION ALL SELECT 'provider_stop_observation',count(*)::int FROM ollama_gateway.provider_stop_observation
    UNION ALL SELECT 'upstream_peer_observation',count(*)::int FROM ollama_gateway.upstream_peer_observation`);
  const categories = { active: 0, lifecycle: 0, unknown: 0, recent: 0, older_terminal_review: 0 };
  const groups = await client.query(`SELECT category,count(*)::int AS n FROM (
    SELECT ${archiveCategorySql} AS category FROM ollama_gateway.request_binding b
      LEFT JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id) classified GROUP BY category`, [row.active_request, row.cutoff]);
  for (const group of groups.rows) categories[group.category] = group.n;
  const counts = Object.fromEntries(countRows.rows.map(entry => [entry.name, entry.n]));
  return validateArchiveReport({ ledgerId: row.id, providerHash: row.provider_hash, capturedAt: row.captured_at.toISOString(),
    cutoff: row.cutoff.toISOString(), retentionDays, attempts: row.attempts, bindingCount: row.binding_count, counts, categories,
    counterMatches: row.binding_count === counts.request_binding,
    legacyActiveWithoutBinding: row.active_request !== null && categories.active === 0, purgeAuthorized: false });
}

/** Dedicated connected session; caller must close it. No mutation, provider I/O or retries. */
export async function withGatewayArchiveSnapshot(client, { providerHash, retentionDays, signal }, consume = async value => value.report) {
  if (typeof providerHash !== 'string' || !/^[a-f0-9]{64}$/.test(providerHash) ||
      !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw gatewayError('gateway_archive_config_invalid');
  let locked = false, transaction = false;
  try {
    signal?.throwIfAborted();
    const held = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
      AND classid=11435 AND objid=1 AND objsubid=2 AND granted) AS held`);
    if (held.rows[0].held) throw gatewayError('gateway_archive_dedicated_session_required');
    locked = (await client.query('SELECT pg_try_advisory_lock(11435,1) AS acquired')).rows[0].acquired;
    if (!locked) throw gatewayError('gateway_archive_gateway_running');
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='75s'");
    await client.query("SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    const report = await reportSnapshot(client, providerHash, retentionDays);
    signal?.throwIfAborted();
    const meta = (await client.query('SELECT uuidv7() AS id,pg_export_snapshot() AS snapshot')).rows[0];
    const output = await consume({ report, archiveId: meta.id, snapshot: meta.snapshot });
    signal?.throwIfAborted();
    await client.query('COMMIT'); transaction = false;
    return output;
  } catch (error) {
    if (transaction) { try { await client.query('ROLLBACK'); } catch { /* Caller closes dedicated session. */ } }
    if (signal?.aborted) throw gatewayError('gateway_archive_cancelled');
    const safe = ['gateway_archive_dedicated_session_required', 'gateway_archive_gateway_running', 'gateway_archive_ledger_unavailable',
      'gateway_archive_report_invalid', 'gateway_archive_inventory_invalid', 'gateway_archive_file_invalid', 'gateway_archive_dump_failed', 'gateway_archive_size_limit'];
    throw gatewayError(safe.includes(error.code) ? error.code : 'gateway_archive_unavailable');
  } finally {
    if (locked) { try { await client.query('SELECT pg_advisory_unlock(11435,1)'); } catch { /* Caller closes dedicated session. */ } }
  }
}
