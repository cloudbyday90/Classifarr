/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { installationBudgetSnapshot, installationPressureEvidence, installationBudgetEvidence } from '../../scripts/installationBudgetContract.mjs';
import { exerciseInstallationConnectionPressure, prepareInstallationConnectionBudget,
  readInstallationPressureEvidence, writeInstallationPressureEvidence } from '../../scripts/installationConnectionPressure.mjs';
import { runInstallationBudgetRecovery } from '../../../../scripts/lib/installationBudgetRecovery.mjs';
import { SCHEDULED_CRASH_BOUNDARY, SCHEDULED_CRASH_RECOVERY } from '../../../../scripts/lib/scheduledInstallationContract.mjs';

import { metrics, pressure, evidence } from '../fixtures/installationBudget.mjs';

test('evidence is allowlisted and cgroup v1/v2 supported without crossing lifetime counters', () => {
  const value = evidence();
  value.postRestart = { ...metrics(), version: 2, oom: 0, underOom: null, cpuUsec: 1, cpuPeriods: 1, cpuThrottledPeriods: 0 };
  value.secret = 'private'; value.pressure.secret = 'private'; value.postRestart.secret = 'private';
  expect(JSON.stringify(installationBudgetEvidence(value))).not.toContain('private');
});
test.each([
  value => { value.pressure.denialCode = 'ECONNRESET'; }, value => { value.pressure.maxConnections = 100; },
  value => { value.pressure.connectionsRemaining = 1; }, value => { value.pressure.connectionsHeld = 32; },
  value => { value.pressure.heldMs = 4999; }, value => { value.pressure.recoveryMs = 15001; },
  value => { value.pressure.freshConnection = 'failed'; }, value => { value.pressure.health = 'unhealthy'; },
  value => { value.postRestart.pidsLimitHits = 1; }, value => { value.postRestart.memoryLimitHits = 1; },
  value => { value.postRestart.oomKill = 1; }, value => { value.postRestart.cpuQuotaUsec = -1; },
  value => { delete value.postRestart.cpuPeriods; }, value => { value.postRestart.pids = 129; },
  value => { value.restartReadyMs = 240001; }, value => { value.backfillRecoveryMs = 900001; },
  value => { value.backfill = 'reseeded'; }, value => { value.dockerLimits = 'assumed'; },
  value => { value.pressure.recovered.cpuUsec = 0; }, value => { value.pressure.pressured.cpuPeriods = 0; },
])('fails closed on incomplete or unsafe budget evidence (%#)', mutate => {
  const value = evidence(); mutate(value);
  expect(() => installationBudgetEvidence(value)).toThrow();
});

let previous;
beforeEach(() => {
  previous = { ...process.env };
  Object.assign(process.env, { CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1', CLASSIFARR_UPGRADE_BUDGET: 'bounded',
    POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr',
    BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' });
});
afterEach(() => { process.env = previous; });

function scenario({ code = '53300', neverFull = false, badHealth = false, leaked = 0, max = '32', idleError = false } = {}) {
  let time = 0, active = 0, attempted = 0;
  const clients = [];
  class Client extends EventEmitter {
    constructor(config) { super(); this.config = config; clients.push(this); this.connected = false; this.ended = false; }
    async connect() {
      attempted++;
      if (!neverFull && active >= 3) throw Object.assign(new Error('private'), { code });
      active++; this.connected = true;
    }
    async query() { return { rows: [{ value: 1 }] }; }
    async end() { if (this.connected) active--; this.connected = false; this.ended = true; }
  }
  const owner = { query: jest.fn(async sql => ({ rows: sql === 'SHOW max_connections' ? [{ max_connections: max }] : [{ count: leaked }] })) };
  const options = { Client, now: () => time, sleep: async ms => { time += ms; if (idleError) clients[0].emit('error', new Error('private')); },
    cgroup: async () => metrics(), health: async () => ({ status: badHealth ? 503 : 200, body: { status: 'healthy' } }) };
  return { owner, options, clients, get attempted() { return attempted; }, get active() { return active; } };
}

test('holds until denial, releases every client, verifies fresh SQL and bounded health', async () => {
  const test = scenario();
  const result = await exerciseInstallationConnectionPressure(test.owner, test.options);
  expect(result).toMatchObject({ connectionsHeld: 3, heldMs: 5000, denialCode: '53300', connectionsRemaining: 0 });
  expect(test.active).toBe(0);
  expect(test.clients.every(client => client.ended)).toBe(true);
  expect(test.clients.every(client => client.config.connectionTimeoutMillis === 1000 && client.config.query_timeout === 1000)).toBe(true);
  expect(installationPressureEvidence(result)).toEqual(result);
});
test.each([{ code: 'ECONNREFUSED' }, { neverFull: true }, { badHealth: true }, { leaked: 1 }, { max: '100' }, { idleError: true }])(
  'fault injection fails safely and always releases held connections %j', async options => {
    const test = scenario(options);
    await expect(exerciseInstallationConnectionPressure(test.owner, test.options)).rejects.toThrow();
    expect(test.active).toBe(0);
    expect(test.attempted).toBeLessThanOrEqual(33);
    expect(test.clients.every(client => client.ended)).toBe(true);
  });
test('all destructive/injected paths reject a normal environment before database or filesystem work', async () => {
  delete process.env.CLASSIFARR_UPGRADE_BUDGET;
  const query = jest.fn();
  await expect(prepareInstallationConnectionBudget({ query })).rejects.toThrow();
  await expect(exerciseInstallationConnectionPressure({ query })).rejects.toThrow();
  await expect(writeInstallationPressureEvidence(pressure())).rejects.toThrow();
  await expect(readInstallationPressureEvidence()).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});

function tools({ dockerCpus = 2e9, badPressure = false } = {}) {
  const compose = jest.fn(args => ({ status: 0, stdout: args[0] === 'ps' ? 'a'.repeat(64) : '' }));
  const docker = jest.fn(args => ({ stdout: args.includes('{{.State.Status}}') ? 'exited'
    : args.includes('{{.State.ExitCode}} {{.State.OOMKilled}}') ? '137 false'
      : JSON.stringify({ nanoCpus: dockerCpus, pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0 }) }));
  const probe = jest.fn(phase => ({ 'budget-prepare': { maxConnections: 32, restartRequired: true },
    'budget-pressure': badPressure ? {} : pressure(), 'budget-snapshot': metrics(),
    'scheduled-crash-ready': SCHEDULED_CRASH_BOUNDARY, 'scheduled-crash-resume': SCHEDULED_CRASH_RECOVERY })[phase]);
  return { compose, docker, probe, start: jest.fn(), poll: async check => { expect(await check()).toBe(true); },
    setStage: jest.fn(), now: () => 0 };
}
test('budget wrapper reuses crash recovery and verifies Docker before setting PG, after prepare and after crash', async () => {
  const test = tools();
  const result = await runInstallationBudgetRecovery(test);
  expect(result.recovery).toEqual(SCHEDULED_CRASH_RECOVERY);
  expect(result.evidence).toMatchObject({ dockerLimits: 'verified', backfill: 'completed_original_inventory' });
  expect(test.start).toHaveBeenCalledTimes(2);
  expect(test.compose.mock.calls.some(([args]) => args.at(-1) === 'scheduled-crash-budget-arm')).toBe(true);
  expect(test.probe.mock.calls.flat()).toEqual(['budget-prepare', 'scheduled-crash-ready', 'budget-pressure', 'scheduled-crash-resume', 'budget-snapshot']);
});
test('wrong Docker budget prevents pressure setup', async () => {
  const test = tools({ dockerCpus: 1e9 });
  await expect(runInstallationBudgetRecovery(test)).rejects.toThrow();
  expect(test.probe).not.toHaveBeenCalled();
});
test('missing pressure evidence cannot pass', async () => {
  const test = tools({ badPressure: true });
  await expect(runInstallationBudgetRecovery(test)).rejects.toThrow();
  expect(test.compose.mock.calls.some(([args]) => args[0] === 'kill')).toBe(false);
});
test('missing cgroup evidence cannot become zero', () => {
  expect(() => installationBudgetSnapshot({})).toThrow();
});
