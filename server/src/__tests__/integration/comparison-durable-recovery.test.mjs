/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPool } from './setup.mjs';
import { createComparisonIncidentSession, COMPARISON_INCIDENT_LOCK } from '../../services/comparisonIncidentSession.mjs';
import { createComparisonIncidentLedger } from '../../services/comparisonIncidentLedger.mjs';
import { createComparisonRecoveryScope } from '../../services/comparisonRecoveryScope.mjs';
import { registerLiveMultiScaleSchedule } from '../../services/liveMultiScaleScheduler.mjs';

jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');
const identity = { provider: 'ollama', model: 'fixture', digest: 'a'.repeat(64), dimensions: 4 };
const unavailable = { status: 'unavailable', failure: { stage: 'snapshot_read', code: 'cached_vectors_incomplete',
  coverage: { cachedDescriptions: 6307, missingDescriptions: 1, eligibleDescriptions: 6308 } } };
let databaseInstance;
function database() {
  databaseInstance ??= createDatabaseModule({ pgModule: { Pool: class { constructor() { return getPool(); } } },
    loggerFactory: () => ({ error: jest.fn(), warn: jest.fn() }), environment: { NODE_ENV: 'production' } });
  return databaseInstance;
}
function runtime(db = database()) {
  const scope = createComparisonRecoveryScope();
  const state = { config: 'private endpoint', identity, report: unavailable, inspect: true };
  const worker = { stop: jest.fn(), beginRecoveryObservation: scope.begin, getRecoveryScope: scope.current,
    getRecoveryFingerprint: scope.fingerprint, withIncidentSession: createComparisonIncidentSession(db),
    run: jest.fn(async () => {
      scope.configure(state.config);
      if (state.inspect) scope.identify(state.identity);
      return state.report;
    }) };
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const log = { warn: jest.fn(async () => null), info: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker, log });
  return { state, worker, log, run: scheduler.schedule.mock.calls[0][2], stop: () => scheduler.liveMultiScaleWorker.stop() };
}
const warnings = async () => (await getPool().query("SELECT * FROM error_log WHERE module='LibraryComparisonContext' ORDER BY id")).rows;
beforeEach(async () => { await getPool().query('DELETE FROM comparison_incident_ledger; DELETE FROM error_log'); });

test('a new scheduler resumes the durable incident and preserves original evidence and manual decisions', async () => {
  const first = runtime();
  try { await first.run(); } finally { first.stop(); }
  const [before] = await warnings();
  expect(before.metadata.comparisonIncident.version).toBe(2);
  expect(before.resolved).toBe(false);
  const second = runtime(); second.state.report = { status: 'ready' };
  try { await second.run(); await second.run(); } finally { second.stop(); }
  const [after] = await warnings();
  expect(after).toMatchObject({ error_id: before.error_id, resolved: true, metadata: {
    ...before.metadata, comparisonRecovery: { version: 2, ...before.metadata.comparisonIncident,
      status: 'ready', observedAt: expect.any(String) } } });
  expect(after.created_at).toEqual(before.created_at);
  expect(after.system_context).toEqual(before.system_context);
  expect(second.log.info).toHaveBeenCalledWith('Library comparison context recovered automatically', {
    comparisonRecovery: expect.objectContaining({ version: 2, resolvedCount: 1 }),
  });
  expect(JSON.stringify((await getPool().query('SELECT * FROM comparison_incident_ledger')).rows)).not.toContain('private endpoint');
});

test.each(['configuration', 'model', 'disable', 'uninspected'])('%s cannot resolve an older durable incident', async change => {
  const first = runtime(); await first.run(); first.stop();
  const second = runtime(); second.state.report = { status: 'ready' };
  if (change === 'configuration') second.state.config = 'different private endpoint';
  if (change === 'model') second.state.identity = { ...identity, digest: 'b'.repeat(64) };
  if (change === 'uninspected') second.state.inspect = false;
  try {
    if (change === 'disable') { second.state.report = { status: 'disabled' }; await second.run(); second.state.report = { status: 'ready' }; }
    await second.run();
    // Returning to the old configuration does not revive an abandoned episode.
    if (change !== 'uninspected') { second.state.config = 'private endpoint'; second.state.identity = identity; await second.run(); }
  } finally { second.stop(); }
  expect((await warnings())[0].resolved).toBe(false);
});

test('an early readiness refusal cannot reuse the previous inspected identity', async () => {
  const v = runtime();
  try {
    await v.run();
    v.worker.run.mockResolvedValueOnce({ status: 'ready' }); // No configure/inspect calls this attempt.
    await v.run(); expect((await warnings())[0].resolved).toBe(false);
    v.state.report = { status: 'revalidated' }; await v.run();
    expect((await warnings())[0].resolved).toBe(true);
  } finally { v.stop(); }
});

test('fresh and disabled installations do not create ledger records', async () => {
  const v = runtime();
  try {
    v.state.report = { status: 'ready' }; await v.run();
    v.state.report = { status: 'disabled' }; await v.run();
    expect((await getPool().query('SELECT * FROM comparison_incident_ledger')).rows).toEqual([]);
  } finally { v.stop(); }
});

test('competing schedulers cannot run comparison work or claim another active session', async () => {
  const first = runtime(), second = runtime(); let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  first.worker.run.mockImplementationOnce(() => new Promise(resolve => { release = resolve; entered(); }));
  const pending = first.run();
  try {
    await ready; expect(await second.run()).toEqual({ status: 'deferred', reason: 'busy' });
    expect(second.worker.run).not.toHaveBeenCalled();
  } finally { release({ status: 'cancelled' }); await pending; first.stop(); second.stop(); }
});

test('terminated ownership cancels a late result and a new session can recover the committed warning', async () => {
  const first = runtime(); await first.run(); first.stop();
  const second = runtime(); let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  second.worker.run.mockImplementationOnce(({ signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('expected session cancellation')), 3000);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve({ status: 'ready' }); }, { once: true }); entered();
  }));
  const pending = second.run(), rejected = expect(pending).rejects.toMatchObject({ code: '57P01' });
  try {
    await ready;
    const { rows } = await getPool().query(`SELECT pid FROM pg_locks WHERE locktype='advisory'
      AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
      AND classid=0 AND objid=$1 AND granted`, [COMPARISON_INCIDENT_LOCK]);
    expect(rows).toHaveLength(1);
    await getPool().query('SELECT pg_terminate_backend($1)', [rows[0].pid]); await rejected;
    expect((await warnings())[0].resolved).toBe(false);
  } finally { second.stop(); }
  const third = runtime(); third.state.report = { status: 'revalidated' };
  try { await third.run(); } finally { third.stop(); }
  expect((await warnings())[0].resolved).toBe(true);
});

test('warning and ledger membership roll back together on owner cancellation', async () => {
  let current = true;
  await database().withSessionAdvisoryLock(COMPARISON_INCIDENT_LOCK, async session => {
    const query = async (...args) => {
      const result = await session.query(...args);
      if (String(args[0]).includes('INSERT INTO comparison_incident_ledger')) current = false;
      return result;
    };
    const ledger = await createComparisonIncidentLedger({ ...session, query }, () => current);
    await ledger.prepare({ configuration: 'c'.repeat(64), representation: 'd'.repeat(64) }, false);
    await expect(ledger.warn({ code: 'cached_vectors_incomplete' })).rejects.toThrow('owner changed');
  });
  expect(await warnings()).toEqual([]);
  expect((await getPool().query('SELECT * FROM comparison_incident_ledger')).rows).toEqual([]);
});

test('resolution and ledger clearing roll back together; a subsequent verified refresh succeeds', async () => {
  const first = runtime(); await first.run(); first.stop();
  let current = true;
  await database().withSessionAdvisoryLock(COMPARISON_INCIDENT_LOCK, async session => {
    const ledger = await createComparisonIncidentLedger({ ...session, query: async (...args) => {
      const result = await session.query(...args);
      if (String(args[0]).includes('INSERT INTO comparison_incident_ledger')) current = false;
      return result;
    } }, () => current);
    const scope = createComparisonRecoveryScope(); scope.configure('private endpoint'); scope.identify(identity);
    await ledger.prepare(scope.fingerprint(ledger.secret), false);
    await expect(ledger.recover({ status: 'ready' })).rejects.toThrow('owner changed');
  });
  expect((await warnings())[0].resolved).toBe(false);
  expect((await getPool().query('SELECT cardinality(error_ids) AS count FROM comparison_incident_ledger')).rows[0].count).toBe(1);
  const last = runtime(); last.state.report = { status: 'ready' };
  try { await last.run(); } finally { last.stop(); }
  expect((await warnings())[0].resolved).toBe(true);
});

test('the ledger is bounded and manual resolutions are not overwritten', async () => {
  await database().withSessionAdvisoryLock(COMPARISON_INCIDENT_LOCK, async session => {
    const ledger = await createComparisonIncidentLedger(session, () => true);
    await ledger.prepare({ configuration: 'c'.repeat(64), representation: 'd'.repeat(64) }, false);
    for (let i = 0; i < 128; i++) expect(await ledger.warn({ code: 'cached_vectors_incomplete' })).not.toBeNull();
    expect(await ledger.warn({ code: 'overflow' })).toBeNull();
    const [manual] = await warnings();
    await getPool().query("UPDATE error_log SET resolved=true, resolution_notes='Manual review' WHERE error_id=$1", [manual.error_id]);
    expect(await ledger.recover({ status: 'ready' })).toMatchObject({ resolvedCount: 127 });
    expect((await warnings())[0]).toMatchObject({ resolution_notes: 'Manual review', metadata: manual.metadata });
  });
  expect(await warnings()).toHaveLength(128);
});

test('a scoped query cannot be used after its session is returned to the pool', async () => {
  let query;
  await database().withSessionAdvisoryLock(COMPARISON_INCIDENT_LOCK, async session => { query = session.query; });
  await expect(query('SELECT 1')).rejects.toThrow('session scope ended');
});

test('a row-lock timeout preserves membership for a later verified refresh', async () => {
  const first = runtime(); await first.run(); first.stop();
  const [row] = await warnings(), client = await getPool().connect();
  const second = runtime(); second.state.report = { status: 'ready' };
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM error_log WHERE error_id=$1 FOR UPDATE', [row.error_id]);
    await second.run();
    expect((await warnings())[0].resolved).toBe(false);
    expect(second.log.info).toHaveBeenCalledWith('Library comparison incident persistence deferred', { code: 'comparison_resolution_deferred' });
    await client.query('ROLLBACK');
    second.state.report = { status: 'revalidated' }; await second.run();
    expect((await warnings())[0].resolved).toBe(true);
  } finally { await client.query('ROLLBACK'); client.release(); second.stop(); }
});

test('ledger storage failure preserves refresh and process-local warning behavior without raw errors', async () => {
  const db = database();
  const broken = { withSessionAdvisoryLock: (key, callback) => db.withSessionAdvisoryLock(key, session => callback({
    ...session, query: (...args) => {
      if (String(args[0]).includes('SELECT * FROM comparison_incident_ledger')) throw new Error('PRIVATE SQL details');
      return session.query(...args);
    },
  })) };
  const v = runtime(broken);
  try {
    expect(await v.run()).toEqual(unavailable);
    expect(v.log.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      comparisonIncident: expect.objectContaining({ version: 1 }),
    }));
    v.state.report = { status: 'ready' }; expect(await v.run()).toEqual({ status: 'ready' });
    expect(JSON.stringify(v.log.info.mock.calls)).not.toContain('PRIVATE');
    expect(v.log.info.mock.calls.filter(([, value]) => value?.code === 'comparison_resolution_deferred')).toHaveLength(1);
  } finally { v.stop(); }
});

test('a committed warning survives actual process termination and is recovered by a new process', async () => {
  const options = getPool().options;
  expect(options.database).toMatch(/^classifarr_suite_[a-f0-9]{12}$/);
  expect(options.user).toBe('test');
  async function runProcess(mode) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|WINDIR|PATH|TEMP|TMP|TMPDIR)$/i.test(key)));
    env.COMPARISON_FIXTURE_DATABASE = JSON.stringify({ host: options.host, port: options.port,
      database: options.database, user: options.user, password: options.password });
    env.NODE_ENV = 'test'; env.LOG_LEVEL = 'silent';
    const child = fork(fileURLToPath(new URL('./helpers/comparisonIncidentProcessEntry.mjs', import.meta.url)), [mode],
      { env, execArgv: [], windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exited = new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); });
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('comparison fixture timed out')), 15_000);
        child.once('error', () => reject(new Error('comparison fixture spawn failed')));
        child.once('exit', () => reject(new Error('comparison fixture exited before receipt')));
        child.once('message', message => message.ok ? resolve(message.result) : reject(new Error('comparison fixture failed')));
      });
    } finally {
      clearTimeout(timer); child.kill('SIGKILL');
      let cleanupTimer;
      try {
        await Promise.race([exited, new Promise((_, reject) => {
          cleanupTimer = setTimeout(() => reject(new Error('comparison fixture did not exit')), 5000);
        })]);
      } finally { clearTimeout(cleanupTimer); }
    }
  }
  const warning = await runProcess('warn');
  expect((await warnings())[0]).toMatchObject({ resolved: false, metadata: warning });
  const recovery = await runProcess('recover');
  expect(recovery).toMatchObject({ version: 2, resolvedCount: 1, episodeId: warning.comparisonIncident.episodeId });
  expect((await warnings())[0].resolved).toBe(true);
});
