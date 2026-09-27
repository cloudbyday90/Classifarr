/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { AppError, ValidationError } from '../utils/appError.mjs';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import {
  BACKUP_RESTORE_SESSION_LOCK_KEY,
  BACKUP_RESTORE_SESSION_OWNER_REASON,
  RUNTIME_MAINTENANCE_LOCK_KEY,
} from '../utils/backupRestoreSessionContract.mjs';

/** Keep restore ownership and every restore query on one disposable PG session. */
export async function withBackupRestoreSession({ database, logger }, callback) {
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'backup_restore', logger });
  let closed = false;
  let transactionActive = false;
  let transactionFailure = null;

  const assertActive = () => {
    lease.assertHealthy();
    if (closed) throw new Error('backup_restore_session_closed');
    if (transactionFailure) throw transactionFailure;
  };
  const query = async (...args) => {
    assertActive();
    const result = await client.query(...args);
    assertActive();
    return result;
  };
  const databaseSession = {
    query,
    async withTransaction(work) {
      assertActive();
      if (transactionActive) throw new Error('backup_restore_transaction_already_active');
      transactionActive = true;
      let committing = false;
      let workClosed = false;
      const transactionQuery = async (...args) => {
        if (workClosed) throw new Error('backup_restore_transaction_closed');
        return query(...args);
      };
      try {
        await query('BEGIN');
        const result = await work({ query: transactionQuery }, { signal: lease.signal });
        workClosed = true;
        assertActive();
        committing = true;
        await query('COMMIT');
        return result;
      } catch (error) {
        // A failed COMMIT has an uncertain outcome. Never reuse or replay that session.
        if (committing) transactionFailure = error;
        if (!closed && !lease.failed) {
          try { await client.query('ROLLBACK'); }
          catch { transactionFailure = error; }
        }
        throw error;
      } finally {
        workClosed = true;
        transactionActive = false;
      }
    },
  };

  try {
    const admission = await query('SELECT pg_try_advisory_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    if (admission.rows[0]?.acquired !== true) {
      throw new AppError('Normal workers or another restore are active. Stop every normal instance before retrying.',
        503, { code: 'RESTORE_RUNTIME_BUSY', isOperational: true });
    }
    const result = await query('SELECT pg_try_advisory_lock($1) AS acquired',
      [BACKUP_RESTORE_SESSION_LOCK_KEY]);
    if (result.rows[0]?.acquired !== true) {
      throw new ValidationError('A backup restore is already in progress. Wait for it to finish before retrying.');
    }
    // Never reclaim a legacy gate: an older process may not participate in this lock.
    await query(
      `UPDATE policy_native_intent_reconciliation_restore_gates
       SET gate_state = 'requires_maintenance', reason_id = 'restore_owner_interrupted',
           restore_token = NULL, verified_at = NULL,
           restore_finished_at = GREATEST(NOW(), restore_started_at), updated_at = NOW()
       WHERE gate_id = 1 AND gate_state = 'restore_in_progress' AND reason_id = $1`,
      [BACKUP_RESTORE_SESSION_OWNER_REASON],
    );
    const resultValue = await callback(databaseSession);
    assertActive();
    if (transactionActive) throw new Error('backup_restore_transaction_not_awaited');
    return resultValue;
  } finally {
    closed = true;
    // Session destruction releases the lock even when rollback/unlock would fail.
    lease.release(true);
  }
}
