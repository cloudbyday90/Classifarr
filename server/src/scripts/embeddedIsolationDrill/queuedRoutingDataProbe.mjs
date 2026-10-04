/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertProbeEnvironment, assertContainerLayout } from './contract.mjs';

try {
  const mode = process.argv[2];
  assert.equal(process.argv.length, 3);
  assert(['seed', 'read', 'disable', 'release-movie', 'release-tv', 'expire-movie', 'expire-tv'].includes(mode));
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  const { queuedRoutingData } = await import('./queuedRoutingState.mjs');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ host: process.env.POSTGRES_HOST, port: 5432,
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
    max: 1, connectionTimeoutMillis: 2000, statement_timeout: 2000 });
  try { process.stdout.write(`${JSON.stringify(await queuedRoutingData(pool, mode))}\n`); }
  finally { await pool.end(); }
} catch (error) {
  const code = /^[0-9A-Z]{5}$/.test(error.code ?? '') ? error.code : 'invalid';
  process.stderr.write(`queued_routing_data_probe_failed:${code}\n`);
  process.exitCode = 1;
}
