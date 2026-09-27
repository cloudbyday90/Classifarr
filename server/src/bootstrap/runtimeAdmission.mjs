/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { seedLegacyRestoreAdmission } from './restoreAdmissionSeed.mjs';

/** Hold until the whole normal process exits, not merely until HTTP closes. */
export async function acquireNormalRuntimeAdmission({ database, onLost, seedMissingGate = seedLegacyRestoreAdmission }) {
  if (database.pool.options?.max < 2) {
    throw new Error('Normal runtime admission requires POSTGRES_POOL_MAX of at least 2.');
  }
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'normal_runtime' });
  let closed = false;
  let lostOwnership = false;
  const lost = () => {
    if (closed || lostOwnership) return;
    lostOwnership = true;
    onLost();
  };
  const assertHealthy = () => {
    lease.assertHealthy();
    if (closed || lostOwnership) throw new Error('normal_runtime_admission_lost');
  };
  lease.signal.addEventListener('abort', lost, { once: true });
  client.once?.('end', lost);
  const release = () => {
    closed = true;
    lease.signal.removeEventListener('abort', lost);
    client.removeListener?.('end', lost);
    lease.release(true);
  };
  try {
    const result = await client.query('SELECT pg_try_advisory_lock_shared($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    assertHealthy();
    if (result.rows[0]?.acquired !== true) throw new Error('Restore maintenance is active. Normal startup is blocked.');
    const table = await client.query("SELECT to_regclass('public.policy_native_intent_reconciliation_restore_gates') AS gate_table");
    assertHealthy();
    if (table.rows[0]?.gate_table) {
      let gate = await client.query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
      if (gate.rows.length === 0 && await seedMissingGate(client)) {
        assertHealthy();
        gate = await client.query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
      }
      if (gate.rows[0]?.gate_state !== 'ready') {
        throw new Error('Restore verification is incomplete. Restart in restore mode to investigate or retry.');
      }
    }
    assertHealthy();
    return { assertHealthy, release };
  } catch (error) {
    release();
    throw error;
  }
}
