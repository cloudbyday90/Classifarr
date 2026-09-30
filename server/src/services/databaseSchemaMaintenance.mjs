/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createMigrationRunner } from '../config/migrations.mjs';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { assertKnownMigrations, readSchemaLedger, requireMigrationFiles } from './databaseSchemaReadiness.mjs';

const SEED_MIGRATION = '20260927_120000_seed_restore_admission_gate.sql';

async function assertRestoreGate(client, applied, { allowLegacySeed = false } = {}) {
  const table = await client.query("SELECT to_regclass('public.policy_native_intent_reconciliation_restore_gates') AS gate_table");
  if (!table.rows[0]?.gate_table) return;
  const gate = await client.query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
  if (gate.rows[0]?.gate_state === 'ready') return;
  if (allowLegacySeed && gate.rows.length === 0 && applied && !applied.includes(SEED_MIGRATION)) return;
  throw new Error('schema_maintenance_restore_verification_required');
}

/** Explicit one-shot operation: uses only the invoking process's database credential. */
export async function runDatabaseSchemaMaintenance({ database, environment = process.env, runnerFactory = createMigrationRunner }) {
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'schema_maintenance' });
  const query = async (...args) => {
    lease.assertHealthy();
    const result = await client.query(...args);
    lease.assertHealthy();
    return result;
  };
  const adapter = {
    query,
    withTransaction: async callback => {
      await query('BEGIN');
      try {
        const result = await callback({ query });
        await query('COMMIT');
        return result;
      } catch (error) {
        // A lost connection must never be replaced halfway through maintenance.
        if (!lease.failed) await query('ROLLBACK');
        throw error;
      }
    },
  };
  try {
    const lock = await query('SELECT pg_try_advisory_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'runtime_or_restore_active' };
    await query("SET statement_timeout = '10min'");
    await query("SET lock_timeout = '5s'");
    await query("SET idle_in_transaction_session_timeout = '30s'");
    await query('SET search_path = public, pg_temp');
    const runner = runnerFactory({ dbClient: adapter, env: environment });
    const files = requireMigrationFiles(runner);
    const applied = await readSchemaLedger(adapter);
    assertKnownMigrations(applied, files);
    await assertRestoreGate(adapter, applied, { allowLegacySeed: true });
    const result = await runner.run();
    const after = await readSchemaLedger(adapter);
    assertKnownMigrations(after, files);
    if (!after || files.some(filename => !after.includes(filename))) throw new Error('schema_maintenance_incomplete');
    await assertRestoreGate(adapter, after);
    lease.assertHealthy();
    return { status: 'complete', ...result };
  } finally {
    // Destroy the pinned session: releases the session lock even after SQL errors.
    lease.release(true);
  }
}
