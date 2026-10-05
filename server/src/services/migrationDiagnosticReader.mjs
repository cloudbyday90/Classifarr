/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMigrationDiagnosticStore } from './migrationDiagnosticStore.mjs';
import { migrationTargetHash, migrationDiagnosticGuidance } from './migrationDiagnosticContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger } from './mediaIdentityReviewContract.mjs';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';

export async function readMigrationDiagnostic({ environment = process.env, store = createMigrationDiagnosticStore({ environment }) } = {}) {
  const result = await store.read();
  if (result.status !== 'available') return result;
  if (result.report.targetHash !== migrationTargetHash(environment)) return { status: 'target_mismatch' };
  return { ...result, ledgerStatus: 'unknown', guidance: migrationDiagnosticGuidance(result.report) };
}

export function createMigrationDiagnosticReader(database, options = {}) {
  return async actorId => {
    const actor = reviewInteger(actorId);
    const client = await database.pool.connect();
    const lease = createDatabaseClientLease(client, { operation: 'migration_diagnostic_read' });
    const query = async (...args) => {
      lease.assertHealthy();
      const result = await client.query(...args);
      lease.assertHealthy();
      return result;
    };
    try {
      await query('BEGIN READ ONLY');
      await query("SET LOCAL statement_timeout = '5s'");
      await query("SET LOCAL lock_timeout = '1s'");
      await requireReviewActor({ query }, actor);
      const result = await readMigrationDiagnostic(options);
      if (result.status === 'available') {
        const failed = result.report.events.findLast(event => event.step === 'migration_failed');
        if (failed?.migration) {
          // Historical evidence is not proof of a currently failing migration.
          const table = await query("SELECT to_regclass('public.schema_migrations') AS ledger");
          const applied = table.rows[0]?.ledger
            ? await query('SELECT 1 FROM public.schema_migrations WHERE filename = $1', [failed.migration])
            : { rows: [] };
          result.ledgerStatus = applied.rows.length ? 'applied_since_failure' : 'not_recorded';
          if (applied.rows.length) result.guidance = 'This migration is now recorded as applied. Do not replay it because of this historical report. Follow the current library guidance for any remaining issue.';
        }
      }
      await query('COMMIT');
      return result;
    } finally {
      // Destroying the session also rolls back a failed read transaction.
      lease.release(true);
    }
  };
}
