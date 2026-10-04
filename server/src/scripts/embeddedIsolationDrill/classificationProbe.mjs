/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertProbeEnvironment, assertContainerLayout } from './contract.mjs';
import { classifyFixture, waitForClassificationFixture } from './classificationFixture.mjs';
import { runHttpRoutingFixture } from './httpRoutingFixture.mjs';
import { waitForHttpRouting } from './httpRoutingState.mjs';

// No application modules (or their constructors) load until the disposable guard passes.
try {
  const mode = process.argv[2];
  assert.equal(process.argv.length, 3);
  assert(['--run', '--verify', '--verify-restored'].includes(mode));
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform },
    { restored: mode === '--verify-restored' });
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  if (mode === '--run') {
    const database = await import('../../config/database.mjs');
    const { startApplication } = await import('../../bootstrap/startApplication.mjs');
    // eslint-disable-next-line n/no-process-exit -- fail-stop the disposable runtime after losing its database admission
    await startApplication({ database, onAdmissionLost: () => process.exit(1) });
    const { classificationService } = await import('../../services/classification.mjs');
    await classifyFixture(database, classificationService);
    await waitForClassificationFixture(database);
    const { tmdbService } = await import('../../services/tmdb.mjs');
    const { hashPassword } = await import('../../services/auth.mjs');
    await runHttpRoutingFixture(database, { tmdbService, hashPassword });
    process.stdout.write('PASS restricted application classified and persisted movie and TV fixtures\n');
    // Real HTTP server and shutdown handlers remain active until the parent sends SIGTERM.
  } else {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ host: process.env.POSTGRES_HOST, port: 5432,
      database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
      max: 1, connectionTimeoutMillis: 2000, statement_timeout: 2000 });
    try { process.stdout.write(`${JSON.stringify({ source: await waitForClassificationFixture(pool),
      http: await waitForHttpRouting(pool) })}\n`); }
    finally { await pool.end(); }
  }
} catch {
  // Never print rows or exception text. A failed application probe must not remain healthy.
  process.stderr.write('restricted_classification_probe_failed\n');
  // eslint-disable-next-line n/no-process-exit -- real HTTP/scheduler handles must not survive a failed disposable probe
  process.exit(1);
}
