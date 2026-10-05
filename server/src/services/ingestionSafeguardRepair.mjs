/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { AppError, ValidationError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger } from './mediaIdentityReviewContract.mjs';
import { readIngestionSafeguardPlan, safeguardEnableSql, SAFEGUARD_TABLES } from './ingestionSafeguardCatalog.mjs';
import { createIngestionRepairBackup } from './ingestionRepairBackup.mjs';

const repairLock = 20261005;
const refuse = (code, message, status = 409) => new AppError(message, status, { code, isOperational: true });
export function createIngestionSafeguardRepair(database, { backup = createIngestionRepairBackup(), now = Date.now } = {}) {
  const plans = new Map();
  let busy = false;
  async function withSession(actor, work) {
    const client = await database.pool.connect();
    const lease = createDatabaseClientLease(client, { operation: 'ingestion_safeguard_repair' });
    const db = { query: async (...args) => { lease.assertHealthy(); const result = await client.query(...args); lease.assertHealthy(); return result; } };
    try {
      await db.query("SET statement_timeout='5s'");
      await db.query("SET lock_timeout='5s'");
      await db.query("SET idle_in_transaction_session_timeout='10s'");
      await requireReviewActor(db, actor);
      return await work(db, lease);
    } finally { lease.release(true); }
  }
  return {
    async preview(actorId) {
      const actor = reviewInteger(actorId);
      for (const [token, plan] of plans) if (plan.expiresAt <= now()) plans.delete(token);
      return withSession(actor, async db => {
        const plan = await readIngestionSafeguardPlan(db);
        let reason = plan.reason;
        if (reason === 'confirmation_required' && !await backup.available()) reason = 'backup_tools_unavailable';
        if (reason === 'confirmation_required' && (busy || plans.size >= 32)) reason = 'busy';
        let token = null, expiresAt = null;
        if (reason === 'confirmation_required') {
          token = randomUUID(); expiresAt = now() + 300_000;
          plans.set(token, { ...plan, actor, expiresAt });
        }
        return { reason, changes: plan.changes, token, expiresAt, scope: 'database', backup: 'ingestion-repair-backups' };
      });
    },
    async apply(actorId, body) {
      const actor = reviewInteger(actorId);
      if (!body || Object.keys(body).sort().join(',') !== 'confirm,token' || body.confirm !== true || typeof body.token !== 'string') {
        throw new ValidationError('Review and confirm the repair first');
      }
      const plan = plans.get(body.token);
      if (!plan || plan.actor !== actor || plan.expiresAt <= now()) throw refuse('repair_review_expired', 'Refresh the repair review before confirming.');
      if (busy) throw refuse('repair_busy', 'A repair is already running. Refresh status when it finishes.');
      plans.delete(body.token); busy = true;
      let committing = false;
      try {
        return await withSession(actor, async (db, lease) => {
          const { rows: [locks] } = await db.query('SELECT pg_try_advisory_lock_shared($1) AND pg_try_advisory_lock($2) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY, repairLock]);
          if (!locks.acquired) throw refuse('repair_busy', 'Database maintenance is active. No repair was made.');
          const before = await readIngestionSafeguardPlan(db);
          if (before.fingerprint !== plan.fingerprint || before.reason !== 'confirmation_required') {
            throw refuse('repair_state_changed', 'Database status changed. Refresh and review again.');
          }
          let saved;
          try { saved = await backup.create(database.pool.options, lease.signal); }
          catch (error) {
            const code = error?.message === 'backup_storage_full' ? 'repair_backup_limit'
              : error?.code === 'ENOSPC' ? 'repair_backup_disk_full'
                : ['EACCES', 'EPERM'].includes(error?.code) || error?.message === 'backup_storage_unsafe' ? 'repair_backup_storage_unavailable'
                  : error?.message === 'backup_connection_unsupported' ? 'repair_backup_connection_unsupported' : 'repair_backup_failed';
            throw refuse(code, 'Backup could not be created or verified. No safeguards were changed.', 503);
          }
          await db.query('BEGIN');
          await db.query("SET LOCAL transaction_timeout='15s'");
          await db.query(`LOCK TABLE ${SAFEGUARD_TABLES.map(table => `public.${table}`).join(',')} IN SHARE ROW EXCLUSIVE MODE`); // sql-interpolation: fixed frozen six-table allowlist, never request input.
          await requireReviewActor(db, actor, true);
          const current = await readIngestionSafeguardPlan(db);
          if (current.fingerprint !== plan.fingerprint || current.reason !== 'confirmation_required') {
            throw refuse('repair_state_changed', 'Database status changed. Backup was retained; refresh the review.');
          }
          for (const change of current.changes) await db.query(safeguardEnableSql(change));
          if ((await readIngestionSafeguardPlan(db)).reason !== 'not_needed') throw new Error('repair_verification_failed');
          const result = await db.query(`INSERT INTO audit_log(user_id,action,metadata)
            VALUES ($1,'ingestion_safeguards_repaired',$2::jsonb) RETURNING id`, [actor, JSON.stringify({ version: 1,
            requestId: body.token, changes: current.changes, backup: saved, verification: 'catalog_verified' })]);
          committing = true;
          await db.query('COMMIT');
          return { status: 'repaired', auditId: result.rows[0].id, backup: saved, changed: current.changes.length };
        });
      } catch (error) {
        // Destroying the pinned session rolls back uncommitted DDL; never retry a lost commit.
        if (committing) throw refuse('repair_outcome_unknown', 'The repair result could not be confirmed. Refresh status; do not repeat the request.', 503);
        if (error instanceof AppError) throw error;
        throw refuse('repair_unavailable', 'Repair could not finish. No repair was committed. Refresh status before reviewing again.', 503);
      } finally { busy = false; }
    },
  };
}
