/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export async function lockCleanupWorker(client) {
  if (!(await client.query('SELECT pg_try_advisory_lock(11435,6) AS acquired')).rows[0].acquired) {
    throw gatewayError('gateway_cleanup_worker_running');
  }
}

export function cleanupRepository(client) {
  return {
    async list() {
      const result = await client.query('SELECT * FROM gateway_cleanup.operation ORDER BY last_attempt_at,id LIMIT 1001');
      if (result.rowCount > 1000) throw gatewayError('gateway_cleanup_capacity');
      return result.rows;
    },
    async admit(hold,policyHash) {
      return (await client.query('SELECT * FROM gateway_cleanup.admit($1,$2,$3,$4)',
        [hold.id,hold.provider_hash,policyHash,hold.candidates_sha256])).rows[0];
    },
    async execute(op) {
      return (await client.query('SELECT * FROM gateway_cleanup.execute_batch($1,$2)',[op.id,op.attempt])).rows[0];
    },
    async reconcile(id) {
      return (await client.query('SELECT * FROM gateway_cleanup.reconcile($1)',[id])).rows[0];
    },
  };
}
