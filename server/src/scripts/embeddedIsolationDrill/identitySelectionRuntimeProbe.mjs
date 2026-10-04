/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import pg from 'pg';
import { MIGRATION_DATABASE, MIGRATION_SOCKET } from './identityMigrationDatabase.mjs';

assert.equal(process.platform, 'linux');
assert.equal(process.getuid(), 1000);
assert.equal(process.argv.length, 2);
assert.equal(process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL, 'disposable-v1');
const client = new pg.Client({ host: MIGRATION_SOCKET, database: MIGRATION_DATABASE, user: 'cf_runtime',
  connectionTimeoutMillis: 2000, statement_timeout: 3000 });
await client.connect();
try {
  // Committed after selection, unlike the rollback-only conversion probe. The
  // immutable source never contains this row; a fallback loses this evidence.
  await client.query("INSERT INTO migration_sentinel VALUES(3,'selected-runtime-write') ON CONFLICT(id) DO NOTHING");
  assert.deepEqual((await client.query('SELECT id,value FROM migration_sentinel ORDER BY id')).rows,
    [{ id: 1, value: 'preserved' }, { id: 3, value: 'selected-runtime-write' }]);
} finally { await client.end(); }
