/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertProbeEnvironment, assertContainerLayout } from './contract.mjs';
import { seedInterruptedRouting, readInterruptedRouting, disableInterruptedRouting } from './interruptedRoutingState.mjs';

try {
  const mode = process.argv[2];
  assert.equal(process.argv.length, 3);
  assert(['seed', 'read', 'disable'].includes(mode));
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ host: process.env.POSTGRES_HOST, port: 5432,
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
    max: 1, connectionTimeoutMillis: 2000, statement_timeout: 2000 });
  try {
    let result;
    if (mode === 'seed') {
      const { default: bcrypt } = await import('bcrypt');
      result = await seedInterruptedRouting(pool, password => bcrypt.hash(password, 12));
    } else if (mode === 'read') result = await readInterruptedRouting(pool);
    else { await disableInterruptedRouting(pool); result = { disabled: true }; }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally { await pool.end(); }
} catch (error) {
  const code = /^[0-9A-Z]{5}$/.test(error.code ?? '') ? error.code : 'invalid';
  process.stderr.write(`interrupted_routing_data_probe_failed:${code}\n`);
  process.exitCode = 1;
}
