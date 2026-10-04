/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { readDatabaseProfilingStatus } from './databaseProfilingStatus.mjs';

/** Fixed optional operation; authority comes only from the invoking process. */
export async function runDatabaseProfilingMaintenance({ database }) {
  let lease;
  try {
    const client = await database.pool.connect();
    lease = createDatabaseClientLease(client, { operation: 'profiling_maintenance' });
    const query = async (...args) => {
      lease.assertHealthy();
      const result = await client.query(...args);
      lease.assertHealthy();
      return result;
    };
    await query("SET statement_timeout = '5s'");
    await query("SET lock_timeout = '1s'");
    await query("SET idle_in_transaction_session_timeout = '5s'");
    await query('BEGIN');
    await query('SET LOCAL search_path = pg_catalog, pg_temp');
    const lock = await query('SELECT pg_try_advisory_xact_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'runtime_or_restore_active' };
    const gate = await query("SELECT to_regclass('public.policy_native_intent_reconciliation_restore_gates') AS gate_table");
    if (gate.rows.length !== 1 || (gate.rows[0].gate_table !== null && typeof gate.rows[0].gate_table !== 'string')) {
      return { status: 'deferred', reason: 'observation_unknown' };
    }
    if (gate.rows[0]?.gate_table) {
      const result = await query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
      if (result.rows[0]?.gate_state !== 'ready') return { status: 'deferred', reason: 'restore_verification_required' };
    }
    const state = await readDatabaseProfilingStatus({ query });
    if (state.active) return { status: 'already_active' };
    if (state.reason !== 'extension_missing') return { status: 'deferred', reason: state.reason };
    const authority = await query(`SELECT current_user = session_user AND rolsuper AS permitted
      FROM pg_catalog.pg_roles WHERE rolname = current_user`);
    if (authority.rows[0]?.permitted !== true) return { status: 'deferred', reason: 'maintenance_authority_required' };
    await query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public');
    if (!(await readDatabaseProfilingStatus({ query })).active) return { status: 'deferred', reason: 'verification_failed' };
    await query('COMMIT');
    return { status: 'installed' };
  } catch {
    // A commit with a lost response is unknown; reassess the catalog next startup.
    return { status: 'deferred', reason: 'database_operation_unconfirmed' };
  } finally {
    // Disconnect rolls back any uncommitted DDL and releases admission, even on errors.
    lease?.release(true);
  }
}
