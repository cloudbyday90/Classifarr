/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import pg from 'pg';
import { Socket } from 'node:net';
import { assertProbeEnvironment, childEnvironment } from './contract.mjs';
import { assessQueueVacuumHandoff } from '../../services/queueVacuumHandoffAssessment.mjs';
import { openQueueMaintenanceHandoff } from '../../services/queueMaintenanceHandoffClient.mjs';

assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
const mode = process.argv[2];
assert(['healthy', 'eligible', 'cooldown', 'invalid'].includes(mode) && process.argv.length === 3);
const env = childEnvironment();
const pool = new pg.Pool({ host: env.POSTGRES_HOST, user: env.POSTGRES_USER, database: env.POSTGRES_DB,
  max: 3, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
let handoff, runtime;
try {
  for (const sql of ["UPDATE queue_vacuum_recovery_state SET attempts = 0", 'DELETE FROM queue_vacuum_recovery_state',
    'TRUNCATE queue_vacuum_recovery_state', 'SET ROLE classifarr']) {
    await assert.rejects(pool.query(sql), error => error.code === '42501');
  }
  const forbidden = new pg.Client({ host: env.POSTGRES_HOST, user: 'classifarr', database: env.POSTGRES_DB, connectionTimeoutMillis: 2000 });
  try { await assert.rejects(forbidden.connect(), error => error.code === '28000'); }
  finally { await forbidden.end(); }
  runtime = await pool.connect();
  await runtime.query('SELECT pg_advisory_lock_shared(2024)');
  if (mode === 'invalid') {
    const channel = new Socket({ fd: 3, readable: true, writable: true });
    await new Promise((resolve, reject) => {
      channel.once('close', resolve); channel.once('error', reject);
      channel.write(Buffer.from('arbitrary SQL is not a capability'));
    });
  } else {
    const before = await assessQueueVacuumHandoff({ database: { pool } });
    assert.equal(before.request, mode !== 'healthy');
    handoff = openQueueMaintenanceHandoff();
    assert(handoff);
    // Even a request made on a healthy setup must not authorize physical work.
    const result = await handoff.request();
    assert.equal(result.status, mode === 'eligible' ? 'complete' : 'deferred');
    assert.equal((await handoff.request()).status, 'deferred');
    await assert.rejects(pool.query('UPDATE queue_vacuum_recovery_state SET attempts = 0'), error => error.code === '42501');
  }
} finally { handoff?.close(); runtime?.release(true); await pool.end(); }
