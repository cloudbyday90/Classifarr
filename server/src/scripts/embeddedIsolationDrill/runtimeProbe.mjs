/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { open, readFile } from 'node:fs/promises';
import pg from 'pg';
import { ADMIN_ROLE, PG_DATA, childEnvironment, assertProbeEnvironment } from './contract.mjs';
import { verifyRuntimeSchemaReadiness } from '../../services/databaseSchemaReadiness.mjs';
import { runQueueVacuumMaintenance } from '../../services/queueVacuumMaintenance.mjs';

export async function probeRuntimeBoundary({ restored = false } = {}) {
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform }, { restored });
  assert.equal(process.getuid(), 1000);
  const status = await readFile('/proc/self/status', 'utf8');
  assert.match(status, /CapEff:\s+0+\n/);
  assert.match(status, /NoNewPrivs:\s+1\n/);
  assert.equal(Object.keys(process.env).some(key => /PASSWORD|SECRET|TOKEN/.test(key)), false);
  for (const path of [`${PG_DATA}/PG_VERSION`, `${PG_DATA}/pg_hba.conf`, '/proc/1/environ']) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed probe allowlist, never operator input
    await assert.rejects(readFile(path), error => ['EACCES', 'EPERM'].includes(error.code));
  }
  for (const path of ['/app/src/index.mjs', '/usr/lib/postgresql18/vector.so', `${PG_DATA}/pg_hba.conf`]) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed probe allowlist, never operator input
    await assert.rejects(async () => { const handle = await open(path, 'r+'); await handle.close(); },
      error => ['EACCES', 'EPERM', 'EROFS'].includes(error.code));
  }
  const env = childEnvironment({ restored });
  const config = { host: env.POSTGRES_HOST, user: env.POSTGRES_USER, database: env.POSTGRES_DB,
    connectionTimeoutMillis: 2000, statement_timeout: 5000, max: 2 };
  for (const override of [{ user: ADMIN_ROLE }, { user: 'postgres' }, { host: '127.0.0.1' }]) {
    const client = new pg.Client({ ...config, ...override });
    try { await assert.rejects(client.connect(), error => ['28000', 'ECONNREFUSED'].includes(error.code)); }
    finally { await client.end(); }
  }
  const pool = new pg.Pool(config);
  try {
    assert.equal((await verifyRuntimeSchemaReadiness({ database: { pool }, environment: env })).status, 'ready');
    assert.equal((await runQueueVacuumMaintenance({ database: { pool } })).reason, 'maintenance_privilege_required');
    for (const sql of [
      `SET ROLE ${ADMIN_ROLE}`, 'CREATE ROLE forbidden_role', 'CREATE TABLE public.forbidden_table(id int)',
      'ALTER TABLE public.schema_migrations ADD COLUMN forbidden int',
      'CREATE INDEX CONCURRENTLY forbidden_image_index ON public.classification_embeddings (image_model)',
      'DROP INDEX CONCURRENTLY public.idx_embeddings_image_hnsw',
      "SELECT pg_read_file('/rehearsal/postgres/PG_VERSION')",
    ]) await assert.rejects(pool.query(sql), error => error.code === '42501');
  } finally { await pool.end(); }
}

if (import.meta.main) {
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--restored'));
  await probeRuntimeBoundary({ restored: process.argv[2] === '--restored' });
}
