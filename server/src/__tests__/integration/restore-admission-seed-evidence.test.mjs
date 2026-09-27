/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { acquireNormalRuntimeAdmission } from '../../bootstrap/runtimeAdmission.mjs';
import { RESTORE_ADMISSION_SEED } from '../../bootstrap/restoreAdmissionSeed.mjs';

// A separate disposable suite DB preserves append-only evidence without disabling
// its trigger or relying on test order to clear it between tests.
test('historical restore evidence forbids synthesizing a missing gate', async () => {
  const pool = getPool();
  await pool.query('DELETE FROM policy_native_intent_reconciliation_restore_gates');
  await pool.query('DELETE FROM schema_migrations WHERE filename=$1', [RESTORE_ADMISSION_SEED]);
  await pool.query(`INSERT INTO policy_backup_restore_verifications
    (restore_mode,backup_version,schema_parity_verified,native_authority_verified,policy_library_mismatch_count,verified_at)
    VALUES ('replace','synthetic',true,true,0,NOW())`);
  await expect(acquireNormalRuntimeAdmission({ database: { pool }, onLost: jest.fn() }))
    .rejects.toThrow('Restore verification is incomplete');
  expect((await pool.query('SELECT * FROM policy_native_intent_reconciliation_restore_gates')).rowCount).toBe(0);
});
