/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import pg from 'pg';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, open } from 'node:fs/promises';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { readStudyCgroup } from './resourceStudyMetrics.mjs';
import { installationBudgetSnapshot, installationPressureEvidence } from './installationBudgetContract.mjs';
import { drillRequest } from './restoreRecoveryProcess.mjs';

const applicationName = 'classifarr-installation-pressure';
const evidencePath = '/app/data/upgrade-drill/connection-pressure.json';

export function assertInstallationBudgetEnvironment() {
  assertUpgradeDrillEnvironment();
  assert.equal(process.env.CLASSIFARR_UPGRADE_BUDGET, 'bounded');
}

export async function prepareInstallationConnectionBudget(db) {
  assertInstallationBudgetEnvironment();
  installationBudgetSnapshot(await readStudyCgroup());
  // Fixed setting, only in the owned disposable PGDATA. Effective after normal restart.
  await db.query("ALTER SYSTEM SET max_connections = '32'");
  return { maxConnections: 32, restartRequired: true };
}

/** Server-wide admission pressure, not saturation of this probe's private pool. */
export async function exerciseInstallationConnectionPressure(owner, { Client = pg.Client, sleep = delay,
  now = () => performance.now(), cgroup = readStudyCgroup, health = () => drillRequest('/health', { timeout: 1000 }) } = {}) {
  assertInstallationBudgetEnvironment();
  assert.equal((await owner.query('SHOW max_connections')).rows[0].max_connections, '32');
  const initial = installationBudgetSnapshot(await cgroup());
  const clients = [];
  let clientError = false, denialCode, pressured, heldMs;
  const createClient = () => {
    const client = new Client({ host: 'localhost', port: 5432, database: 'classifarr', user: 'classifarr', password: '',
      application_name: applicationName, connectionTimeoutMillis: 1000, query_timeout: 1000, statement_timeout: 1000 });
    client.on('error', () => { clientError = true; });
    return client;
  };
  try {
    for (let attempt = 0; attempt < 33; attempt += 1) {
      const client = createClient();
      try { await client.connect(); clients.push(client); }
      catch (error) {
        await client.end();
        assert.equal(error.code, '53300');
        denialCode = '53300';
        break;
      }
    }
    assert.equal(denialCode, '53300');
    assert.ok(clients.length > 0 && clients.length < 32);
    const heldAt = now();
    // Timers are approximate. Prove the elapsed hold, including an early wake,
    // without relaxing the existing 5–15 second evidence contract.
    heldMs = 0;
    for (let wake = 0; heldMs < 5000 && wake < 100; wake += 1) {
      await sleep(Math.max(1, Math.ceil(5000 - heldMs)));
      heldMs = now() - heldAt;
    }
    assert.equal(clientError, false);
    pressured = installationBudgetSnapshot(await cgroup());
  } finally {
    const released = await Promise.allSettled(clients.map(client => client.end()));
    assert.ok(released.every(result => result.status === 'fulfilled'));
  }
  const releasedAt = now();
  const remaining = (await owner.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE application_name=$1',
    [applicationName])).rows[0].count;
  assert.equal(remaining, 0);
  const fresh = createClient();
  try { await fresh.connect(); await fresh.query('SELECT 1'); }
  finally { await fresh.end(); }
  let healthy = false;
  while (now() - releasedAt < 15000) {
    try { const result = await health(); healthy = result.status === 200 && result.body?.status === 'healthy'; }
    catch { /* Bounded readiness polling; never retry a write. */ }
    if (healthy) break;
    await sleep(250);
  }
  assert.equal(healthy, true);
  assert.equal(clientError, false);
  return installationPressureEvidence({ maxConnections: 32, denialCode, connectionsHeld: clients.length,
    connectionsRemaining: remaining, heldMs, recoveryMs: now() - releasedAt, freshConnection: 'passed', health: 'healthy',
    initial, pressured, recovered: await cgroup() });
}

export async function writeInstallationPressureEvidence(value) {
  assertInstallationBudgetEnvironment();
  const evidence = installationPressureEvidence(value);
  await mkdir('/app/data/upgrade-drill', { recursive: true, mode: 0o700 });
  const file = await open(evidencePath, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(evidence)); await file.sync(); }
  finally { await file.close(); }
}

export async function readInstallationPressureEvidence() {
  assertInstallationBudgetEnvironment();
  const file = await open(evidencePath, 'r');
  try {
    assert.ok((await file.stat()).size <= 8192);
    return installationPressureEvidence(JSON.parse(await file.readFile('utf8')));
  } finally { await file.close(); }
}
