/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { open, readFile } from 'node:fs/promises';
import pg from 'pg';
import { MIGRATION_DATABASE, MIGRATION_SOCKET, migrationEnvironment } from './identityMigrationDatabase.mjs';
import { verifyRuntimeSchemaReadiness } from '../../services/databaseSchemaReadiness.mjs';

assert.equal(process.platform, 'linux');
assert.equal(process.getuid(), 1000);
assert.equal(process.argv.length, 2);
assert.equal(process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL, 'disposable-v1');
const config = { host: MIGRATION_SOCKET, database: MIGRATION_DATABASE, user: 'cf_runtime', connectionTimeoutMillis: 2000, statement_timeout: 3000 };
for (const user of ['classifarr', 'postgres']) {
  const client = new pg.Client({ ...config, user, password: 'synthetic_previous_password' });
  try { await assert.rejects(client.connect(), error => error.code === '28000'); }
  finally { await client.end(); }
}
await assert.rejects(readFile('/app/data/embedded-postgres/candidate/PG_VERSION'), error => error.code === 'EACCES');
await assert.rejects(open('/app/data/embedded-postgres/pg_hba.conf', 'r+'), error => error.code === 'EACCES');
const client = new pg.Client(config);
await client.connect();
try {
  assert.equal((await client.query('SELECT value FROM migration_sentinel WHERE id=1')).rows[0].value, 'preserved');
  await client.query('BEGIN');
  await client.query("INSERT INTO migration_sentinel VALUES (2,'runtime-write')");
  await client.query('ROLLBACK');
  for (const sql of ['SET ROLE classifarr', 'CREATE TABLE public.forbidden(id integer)', 'CREATE ROLE forbidden',
    "SELECT pg_read_file('/app/data/embedded-postgres/candidate/PG_VERSION')"]) {
    await assert.rejects(client.query(sql), error => error.code === '42501');
  }
} finally { await client.end(); }
const pool = new pg.Pool(config);
try {
  assert.equal((await verifyRuntimeSchemaReadiness({ database: { pool }, environment: {
    ...migrationEnvironment(), POSTGRES_USER: 'cf_runtime', CLASSIFARR_SCHEMA_MAINTENANCE: 'external',
  } })).status, 'ready');
} finally { await pool.end(); }
