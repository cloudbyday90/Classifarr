/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { withBackupRestoreSession } from '../../services/backupRestoreSession.mjs';
import {
  beginNativeIntentReconciliationRestore,
  completeNativeIntentReconciliationRestore,
  loadNativeIntentReconciliationRestoreGate,
} from '../../services/nativeIntentReconciliationLifecyclePersistence.mjs';
import { BACKUP_RESTORE_SESSION_OWNER_REASON } from '../../utils/backupRestoreSessionContract.mjs';

const run = callback => withBackupRestoreSession({ database: { pool: getPool() }, logger: undefined }, callback);
const loadGate = () => loadNativeIntentReconciliationRestoreGate({ db: getPool() });
const start = (db, restoreToken, sessionOwned = true) => beginNativeIntentReconciliationRestore({
  db, restoreToken, startedAt: new Date(), sessionOwned,
});

beforeAll(async () => {
  await getPool().query('CREATE TABLE restore_session_probe (value text NOT NULL)');
});

beforeEach(async () => {
  await getPool().query('TRUNCATE restore_session_probe');
  await getPool().query(`UPDATE policy_native_intent_reconciliation_restore_gates
    SET gate_state = 'ready', reason_id = 'startup_ready', restore_token = NULL,
        restore_started_at = NULL, restore_finished_at = NULL, verified_at = NULL WHERE gate_id = 1`);
});

describe('PostgreSQL restore session ownership', () => {
  test('a second owner cannot reclaim a live gate or execute its callback', async () => {
    const token = randomUUID();
    const competitor = jest.fn();
    await run(async db => {
      await start(db, token);
      await expect(run(competitor)).rejects.toThrow('Stop every normal instance');
      expect(await loadGate()).toMatchObject({ restore_token: token, gate_state: 'restore_in_progress' });
      await db.withTransaction(async tx => {
        await tx.query("INSERT INTO restore_session_probe VALUES ('first owner')");
      });
      await expect(run(competitor)).rejects.toThrow('Stop every normal instance');
    });
    expect(competitor).not.toHaveBeenCalled();
  });

  test.each(['restore_in_progress', 'unknown_owner_v9'])('does not steal a legacy/unknown gate (%s)', async reasonId => {
    const token = randomUUID();
    await start(getPool(), token, false);
    await getPool().query('UPDATE policy_native_intent_reconciliation_restore_gates SET reason_id = $1', [reasonId]);
    await run(async db => {
      expect(await start(db, randomUUID())).toBeNull();
      expect(await loadGate()).toMatchObject({ restore_token: token, reason_id: reasonId, gate_state: 'restore_in_progress' });
    });
  });

  test('an explicitly retried interrupted attempt stays closed until the new token completes', async () => {
    const oldToken = randomUUID(), newToken = randomUUID();
    await run(async db => { await start(db, oldToken); });
    await run(async db => {
      expect(await loadGate()).toMatchObject({
        gate_state: 'requires_maintenance', reason_id: 'restore_owner_interrupted',
        restore_token: null, verified_at: null,
      });
      expect(await start(db, newToken)).toMatchObject({ restore_token: newToken });
      const complete = restoreToken => completeNativeIntentReconciliationRestore({
        db, restoreToken, finishedAt: new Date(), reasonId: 'restore_verified',
      });
      expect(await complete(oldToken)).toBeNull();
      expect(await loadGate()).toMatchObject({ gate_state: 'restore_in_progress', verified_at: null });
      await db.withTransaction(async tx => {
        await completeNativeIntentReconciliationRestore({
          db: tx, restoreToken: newToken, finishedAt: new Date(), reasonId: 'restore_verified',
        });
      });
    });
    expect(await loadGate()).toMatchObject({ gate_state: 'ready', reason_id: 'restore_verified', restore_token: null });
  });

  test('recovers a future-dated interrupted gate without violating the timestamp constraint', async () => {
    await start(getPool(), randomUUID());
    await getPool().query(`UPDATE policy_native_intent_reconciliation_restore_gates
      SET restore_started_at = NOW() + INTERVAL '1 day'`);
    await run(async () => {
      const gate = await loadGate();
      expect(gate.gate_state).toBe('requires_maintenance');
      expect(gate.restore_finished_at).toEqual(gate.restore_started_at);
    });
  });

  test('rollback preserves prior committed configuration and ownership until callback exit', async () => {
    const error = new Error('synthetic restore failure');
    await getPool().query("INSERT INTO restore_session_probe VALUES ('original')");
    await run(async db => {
      await start(db, randomUUID());
      await expect(db.withTransaction(async tx => {
        await tx.query('DELETE FROM restore_session_probe');
        await tx.query("INSERT INTO restore_session_probe VALUES ('replacement')");
        throw error;
      })).rejects.toBe(error);
      expect((await db.query('SELECT value FROM restore_session_probe')).rows).toEqual([{ value: 'original' }]);
      await expect(run(jest.fn())).rejects.toThrow('Stop every normal instance');
    });
  });

  test('terminating only the isolated owner rolls back its write and permits a fresh explicit attempt', async () => {
    const token = randomUUID(), newToken = randomUUID();
    let staleDb;
    await expect(run(async db => {
      staleDb = db;
      await start(db, token);
      await db.withTransaction(async (tx, { signal }) => {
        const { rows } = await tx.query('SELECT pg_backend_pid() AS pid');
        await tx.query("INSERT INTO restore_session_probe VALUES ('must roll back')");
        const lost = new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }); });
        // getPool is a per-suite disposable database, never the application's pool.
        await getPool().query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
        await lost;
        await tx.query("INSERT INTO restore_session_probe VALUES ('must not run')");
      });
    })).rejects.toThrow();
    expect((await getPool().query('SELECT * FROM restore_session_probe')).rows).toEqual([]);
    expect(await loadGate()).toMatchObject({
      gate_state: 'restore_in_progress', reason_id: BACKUP_RESTORE_SESSION_OWNER_REASON, restore_token: token,
    });
    await run(async db => {
      expect(await loadGate()).toMatchObject({ gate_state: 'requires_maintenance', verified_at: null });
      await start(db, newToken);
      await expect(staleDb.query("INSERT INTO restore_session_probe VALUES ('stale owner')")).rejects.toThrow();
      expect(await loadGate()).toMatchObject({ restore_token: newToken, gate_state: 'restore_in_progress' });
    });
  });

  test('a failed completion receipt rolls back ready state on the same session', async () => {
    const token = randomUUID();
    await run(async db => {
      await start(db, token);
      await expect(db.withTransaction(async tx => {
        await completeNativeIntentReconciliationRestore({ db: tx, restoreToken: token, finishedAt: new Date(), reasonId: 'restore_verified' });
        await tx.query('INSERT INTO restore_session_probe VALUES (NULL)');
      })).rejects.toThrow();
      expect(await loadGate()).toMatchObject({ gate_state: 'restore_in_progress', restore_token: token, verified_at: null });
    });
  });
});
