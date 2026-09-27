/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { acquireNormalRuntimeAdmission } from '../../bootstrap/runtimeAdmission.mjs';
import { withBackupRestoreSession } from '../../services/backupRestoreSession.mjs';
import { beginNativeIntentReconciliationRestore, completeNativeIntentReconciliationRestore } from '../../services/nativeIntentReconciliationLifecyclePersistence.mjs';

const admit = (onLost = jest.fn()) => acquireNormalRuntimeAdmission({ database: { pool: getPool() }, onLost });
const restore = work => withBackupRestoreSession({ database: { pool: getPool() } }, work);
beforeEach(async () => {
  await getPool().query(`UPDATE policy_native_intent_reconciliation_restore_gates SET
    gate_state = 'ready', reason_id = 'startup_ready', restore_token = NULL,
    restore_started_at = NULL, restore_finished_at = NULL, verified_at = NULL WHERE gate_id = 1`);
});

test('multiple normal instances exclude restoration until every instance exits', async () => {
  const first = await admit();
  const second = await admit();
  const work = jest.fn();
  try {
    await expect(restore(work)).rejects.toMatchObject({ code: 'RESTORE_RUNTIME_BUSY' });
    first.release();
    await expect(restore(work)).rejects.toMatchObject({ code: 'RESTORE_RUNTIME_BUSY' });
    expect(work).not.toHaveBeenCalled();
    expect((await getPool().query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates')).rows[0].gate_state).toBe('ready');
  } finally { first.release(); second.release(); }
  await restore(work);
  expect(work).toHaveBeenCalledTimes(1);
});

test('active restore excludes normal startup, verified completion permits a new startup', async () => {
  const token = randomUUID();
  await restore(async db => {
    await beginNativeIntentReconciliationRestore({ db, restoreToken: token, startedAt: new Date(), sessionOwned: true });
    await expect(admit()).rejects.toThrow('Normal startup is blocked');
    await completeNativeIntentReconciliationRestore({ db, restoreToken: token, finishedAt: new Date(), reasonId: 'restore_verified' });
    await expect(admit()).rejects.toThrow('Normal startup is blocked');
  });
  const next = await admit();
  next.release();
});

test('interrupted restore cannot resume normal workers even after ownership ends', async () => {
  await restore(db => beginNativeIntentReconciliationRestore({ db, restoreToken: randomUUID(), startedAt: new Date(), sessionOwned: true }));
  await expect(admit()).rejects.toThrow('Restore verification is incomplete');
  await restore(async () => {});
  await expect(admit()).rejects.toThrow('Restore verification is incomplete');
});

test('terminating only the isolated normal owner triggers fail-stop and invalidates admission', async () => {
  const client = await getPool().connect();
  const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
  const lost = Promise.withResolvers();
  const onLost = jest.fn(() => lost.resolve());
  const admission = await acquireNormalRuntimeAdmission({ database: { pool: { connect: async () => client } }, onLost });
  try {
    // The PID belongs to this suite's disposable database, never the user's application.
    await getPool().query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
    await lost.promise;
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(() => admission.assertHealthy()).toThrow();
  } finally { admission.release(); }
});
