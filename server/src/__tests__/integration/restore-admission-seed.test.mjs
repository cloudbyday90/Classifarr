/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { acquireNormalRuntimeAdmission } from '../../bootstrap/runtimeAdmission.mjs';
import { RESTORE_ADMISSION_SEED } from '../../bootstrap/restoreAdmissionSeed.mjs';

const admit = () => acquireNormalRuntimeAdmission({ database: { pool: getPool() }, onLost: jest.fn() });
beforeEach(async () => {
  await getPool().query('DELETE FROM policy_native_intent_reconciliation_restore_gates');
  await getPool().query('DELETE FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED]);
});
test('legacy snapshot omission gets exactly one initialization, never a second repair after deletion', async () => {
  const admission = await admit();
  admission.release();
  expect((await getPool().query('SELECT gate_state,reason_id FROM policy_native_intent_reconciliation_restore_gates')).rows)
    .toEqual([{ gate_state: 'ready', reason_id: 'startup_ready' }]);
  expect((await getPool().query('SELECT filename FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED])).rowCount).toBe(1);
  await getPool().query('DELETE FROM policy_native_intent_reconciliation_restore_gates');
  await expect(admit()).rejects.toThrow('Restore verification is incomplete');
});
test('pending seed never reopens an existing maintenance gate', async () => {
  await getPool().query(`INSERT INTO policy_native_intent_reconciliation_restore_gates
    (gate_id,gate_state,reason_id) VALUES (1,'requires_maintenance','restore_validation_failed')`);
  await expect(admit()).rejects.toThrow('Restore verification is incomplete');
  expect((await getPool().query('SELECT filename FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED])).rowCount).toBe(0);
});
test('competing admission owner prevents early seed writes', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock_shared(2024)');
    await expect(admit()).rejects.toThrow('Restore verification is incomplete');
    expect((await getPool().query('SELECT * FROM policy_native_intent_reconciliation_restore_gates')).rowCount).toBe(0);
  } finally { owner.release(true); }
});
