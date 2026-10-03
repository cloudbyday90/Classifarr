/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { assertFixtureEnvironment, findProcess, poll, receipt } from './common.mjs';

const connection = { host: 'localhost', port: 5432, user: 'classifarr', database: 'classifarr',
  connectionTimeoutMillis: 3000, statement_timeout: 5000 };
let phase = 'environment';

async function run() {
  await assertFixtureEnvironment();
  const mode = process.argv[2];
  assert(['drain', 'frozen'].includes(mode) && process.argv.length === 3);
  const observer = new pg.Client(connection), blocker = new pg.Client(connection);
  // Fast database shutdown closes these fixture sessions; it is expected after
  // the work-in-flight receipt, not an uncaught exception in the injected client.
  observer.on('error', () => {}); blocker.on('error', () => {});
  const abort = new AbortController();
  try {
    phase = 'connect';
    await observer.connect(); await blocker.connect();
    const counts = await observer.query('SELECT (SELECT count(*) FROM libraries)::int AS libraries, (SELECT count(*) FROM users)::int AS users');
    assert.deepEqual(counts.rows, [{ libraries: 0, users: 1 }]);
    assert.deepEqual((await observer.query('SELECT username, is_active FROM users')).rows,
      [{ username: 'shutdown-drill', is_active: false }]);
    assert.deepEqual((await observer.query('SELECT value FROM shutdown_sentinel')).rows, [{ value: 'preserved' }]);
    await observer.query("INSERT INTO queue_vacuum_recovery_state (singleton, last_result) VALUES (true, 'shutdown_drill') ON CONFLICT (singleton) DO UPDATE SET last_result = EXCLUDED.last_result");
    await blocker.query('BEGIN');
    const blockerPid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await blocker.query('LOCK TABLE users, policy_native_intent_reconciliation_restore_gates IN ACCESS EXCLUSIVE MODE');
    await blocker.query("INSERT INTO shutdown_sentinel VALUES ('uncommitted')");
    phase = 'http_wait';
    const request = fetch('http://127.0.0.1:21324/api/setup/status', { signal: abort.signal })
      .then(async response => ({ status: response.status, body: await response.json() }), () => ({ status: 'interrupted' }));
    const waiting = async query => (await observer.query(`SELECT pid FROM pg_stat_activity
      WHERE query = $1 AND wait_event_type = 'Lock' AND $2 = ANY(pg_blocking_pids(pid))`, [query, blockerPid])).rows.length === 1;
    await poll(() => waiting('SELECT COUNT(*) FROM users'));
    const application = await findProcess('/app/src/index.mjs'); assert(application);
    process.kill(application, 'SIGUSR2');
    phase = 'assessment_wait';
    await poll(() => waiting('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1'));
    const worker = await findProcess('/app/src/scripts/runCompatibleQueueRecovery.mjs'); assert(worker);
    const supervisor = await findProcess('src/scripts/runEmbeddedSupervisor.mjs'); assert(supervisor);
    phase = 'process_identity';
    for (const pid of [application, worker]) {
      assert.match(await readFile(`/proc/${pid}/status`, 'utf8'), new RegExp(`^PPid:\\s+${supervisor}$`, 'm'));
    }
    process.kill(worker, 'SIGSTOP');
    await poll(async () => /^State:\s+T/m.test(await readFile(`/proc/${worker}/status`, 'utf8')));
    if (mode === 'frozen') {
      process.kill(application, 'SIGSTOP');
      await poll(async () => /^State:\s+T/m.test(await readFile(`/proc/${application}/status`, 'utf8')));
    }
    await receipt('ready', { mode, application, worker, httpBlocked: true, assessmentBlocked: true, uncommitted: true });
    phase = 'signal_and_drain';
    if (mode === 'drain') {
      await poll(async () => {
        try { return JSON.parse(await readFile('/app/data/shutdown-signal.json', 'utf8')).signal === 'SIGTERM'; }
        catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return false; throw error; }
      }, 30_000);
      await blocker.query('ROLLBACK');
      const response = await request;
      assert.equal(response.status, 200);
      // The route's error fallback says setupRequired=true. A known disabled
      // fixture user proves the request actually read the database after drain.
      assert.equal(response.body.setupRequired, false);
      assert.equal(response.body.setupComplete, true);
      await receipt('http', { status: 200, completedAfterSignal: true });
    } else {
      // Keep the transaction and locks alive until the real app is killed.
      assert.equal((await request).status, 'interrupted');
    }
  } finally {
    abort.abort();
    await Promise.allSettled([blocker.end(), observer.end()]);
  }
}

// Docker owns the outer deadline. This inner bound also protects standalone
// accidental invocation on a disposable fixture if the host never sends stop.
const timer = setTimeout(() => {
  void receipt('failure', { phase: 'workload_deadline' }).finally(() => process.exit(1));
}, 80_000);
try { await run(); }
catch (error) { await receipt('failure', { phase, reason: String(error.message).slice(0, 500) }); process.exitCode = 1; }
finally { clearTimeout(timer); }
