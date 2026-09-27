/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMigrationRunner } from '../config/migrations.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';

export const RESTORE_ADMISSION_SEED = '20260927_120000_seed_restore_admission_gate.sql';

/** Only repair the pre-migration snapshot omission, never a deleted modern gate. */
export async function seedLegacyRestoreAdmission(client, { createRunner = createMigrationRunner } = {}) {
  const prerequisite = await client.query(`SELECT
    to_regclass('public.schema_migrations') AS migrations_table,
    to_regclass('public.policy_backup_restore_verifications') AS receipts_table`);
  if (!prerequisite.rows[0]?.migrations_table || !prerequisite.rows[0]?.receipts_table) return false;
  const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED]);
  if (applied.rows.length) return false;
  // The caller already holds shared admission. Upgrade only when no other
  // cooperating normal/restore owner exists; never wait or reset its state.
  const ownership = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
  if (ownership.rows[0]?.acquired !== true) return false;
  try {
    const runner = createRunner({ dbClient: {
      async withTransaction(work) {
        await client.query('BEGIN');
        try {
          // Recheck under the exclusive lock: seed and ledger commit together.
          const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED]);
          if (!alreadyApplied.rows.length) await work(client);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      },
    } });
    await runner.applyMigration(RESTORE_ADMISSION_SEED);
    return true;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
  }
}
