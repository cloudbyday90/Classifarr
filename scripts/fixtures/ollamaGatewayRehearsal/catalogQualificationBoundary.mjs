/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';

/** Fixture-owned SQL blocker, never installed in the packaged worker. */
export async function catalogQualificationBoundary(mode) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
  assert.ok(['publication','acknowledgment'].includes(mode));
  const client = new pg.Client({ host: '/source-socket', user: 'classifarr', database: 'gateway_catalog_qualification',
    connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  await client.connect();
  const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  let job;
  const lock = async () => {
    const state = mode === 'publication' ? 'exporting' : 'awaiting_verification';
    const row = (await client.query('SELECT id,attempt,status FROM gateway_catalog.job WHERE status=$1', [state])).rows[0];
    if (!row) return;
    await client.query('BEGIN');
    job = (await client.query('SELECT id,attempt,status FROM gateway_catalog.job WHERE id=$1 AND status=$2 FOR UPDATE', [row.id,state])).rows[0];
    assert.ok(job);
  };
  if (mode === 'acknowledgment') await lock();
  return {
    async observe() {
      if (!job) await lock();
      if (!job) return null;
      // PostgreSQL may cache activity statistics inside our deliberate transaction.
      await client.query('SELECT pg_stat_clear_snapshot()');
      const blocked = (await client.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
        AND application_name='classifarr-gateway-archive-coordinator' AND $1::int=ANY(pg_blocking_pids(pid))
        AND query LIKE 'UPDATE gateway_catalog.job SET status=%'`, [pid])).rows;
      if (!blocked.length) return null;
      assert.equal(blocked.length, 1);
      const marker = await stat(`/catalogs/gateway-archive-${job.id}/manifest.json`);
      assert.ok(marker.size > 0);
      const roots = (await client.query('SELECT id FROM gateway_catalog.snapshot WHERE archive_id=$1', [job.id])).rows;
      assert.equal(roots.length, mode === 'acknowledgment' ? 1 : 0);
      return { mode, job, markerBytes: marker.size, registered: roots.length, blockedBackend: blocked[0].pid };
    },
    async close() { try { await client.query('ROLLBACK'); } finally { await client.end(); } },
  };
}
