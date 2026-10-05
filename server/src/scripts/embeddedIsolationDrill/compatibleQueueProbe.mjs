/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { observeEmbeddedChild } from '../../bootstrap/embeddedChildProcess.mjs';
import { createCompatibleQueueMaintenanceBroker, startCompatibleQueueMaintenance } from '../../bootstrap/embeddedCompatibleQueueMaintenance.mjs';
import { assessQueueVacuumHandoff } from '../../services/queueVacuumHandoffAssessment.mjs';
import { ingestionConnectionOptions } from '../../config/ingestionProtocol.mjs';

// Only the collision-checked Compose drill invokes this against its fresh volumes.
assert.equal(process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL, 'disposable-v1');
assert.equal(process.platform, 'linux'); assert(process.getuid() > 0);
assert.equal(process.argv.length, 2);
assert.deepEqual(await readdir('/sys/class/net'), ['lo']);
const mounts = await readFile('/proc/self/mountinfo', 'utf8');
assert(mounts.split('\n').some(line => line.split(' ')[4] === '/app/data'));
const connection = { host: 'localhost', port: 5432, user: 'classifarr', database: 'classifarr',
  connectionTimeoutMillis: 3000, statement_timeout: 5000, options: ingestionConnectionOptions() };
async function sql(text) {
  const client = new pg.Client(connection);
  try { await client.connect(); return (await client.query(text)).rows; }
  finally { await client.end(); }
}
assert.deepEqual(await sql('SELECT value FROM supervisor_sentinel'), [{ value: 'preserved' }]);
assert.equal((await sql('SELECT count(*)::int AS count FROM libraries'))[0].count, 0);
const [{ reloptions }] = await sql("SELECT reloptions FROM pg_class WHERE oid='task_queue'::regclass");
assert(reloptions.includes('autovacuum_vacuum_threshold=50'));
assert(reloptions.includes('autovacuum_vacuum_insert_threshold=500'));
// Keep autovacuum enabled for real policy admission, but prevent its worker from
// consuming synthetic pressure between assertions. Only this disposable table.
await sql(`ALTER TABLE task_queue SET (autovacuum_vacuum_threshold=1000000000,
  autovacuum_vacuum_insert_threshold=1000000000)`);
const pool = new pg.Pool({ ...connection, max: 1 });
try {
  assert.equal((await assessQueueVacuumHandoff({ database: { pool } })).request, false);
} finally { await pool.end(); }

const requestProgram = `import assert from 'node:assert/strict';
import { openQueueMaintenanceHandoff } from '/app/src/services/queueMaintenanceHandoffClient.mjs';
const handoff = openQueueMaintenanceHandoff(); assert(handoff);
// Production owns an HTTP server; this tiny fixture needs its own bounded liveness handle.
const keepAlive = setTimeout(() => { process.exitCode = 1; handoff.close(); }, 100000);
try { assert.equal((await handoff.request()).status, process.argv[1]); }
finally { clearTimeout(keepAlive); handoff.close(); }`;
async function assess(expected) {
  const child = spawn('/usr/local/bin/node', ['--input-type=module', '-e', requestProgram, expected], {
    cwd: '/app', shell: false, env: { CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' },
    stdio: ['ignore', 'inherit', 'inherit', 'pipe'],
  });
  const runtime = observeEmbeddedChild(child), events = [];
  let starts = 0;
  const broker = createCompatibleQueueMaintenanceBroker({ channel: child.stdio[3],
    start: () => { starts += 1; return startCompatibleQueueMaintenance(); },
    report: status => events.push(status), onFatal: () => runtime.signal('SIGKILL') });
  try { assert.deepEqual(await runtime.done, { code: 0, signal: null }); }
  finally { await broker.stop(); }
  assert.equal(starts, 1);
  assert(events.includes(expected === 'complete' ? 'completed' : 'deferred'));
}
async function pressure() {
  await sql(`ALTER TABLE task_queue SET (autovacuum_enabled = false);
    INSERT INTO task_queue (task_type, payload, status)
    SELECT 'compatible_worker_fixture', '{}', 'completed' FROM generate_series(1, 15000);
    DELETE FROM task_queue WHERE task_type = 'compatible_worker_fixture'`);
  assert(Number((await sql("SELECT n_dead_tup FROM pg_stat_all_tables WHERE relid = 'task_queue'::regclass"))[0].n_dead_tup) >= 10000);
  await sql(`UPDATE queue_vacuum_recovery_state SET
    statistics_epoch = (SELECT c.oid::text || ':' || COALESCE(to_char(d.stats_reset AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'initial')
      FROM pg_class c, pg_stat_database d WHERE c.oid = 'task_queue'::regclass AND d.datname = current_database()),
    vacuum_progress = (SELECT vacuum_count::text || ':' || autovacuum_count::text FROM pg_stat_all_tables WHERE relid = 'task_queue'::regclass),
    pressure_since = clock_timestamp() - INTERVAL '2 hours', observed_at = clock_timestamp() - INTERVAL '15 minutes';
    ALTER TABLE task_queue RESET (autovacuum_enabled)`);
}

await assess('deferred'); // Healthy requests cannot authorize physical work.
await pressure();
await assess('deferred'); // Fresh setup has no inventory readiness.
assert.deepEqual(await sql('SELECT attempts, last_result FROM queue_vacuum_recovery_state'),
  [{ attempts: 0, last_result: 'waiting_for_platform_idle' }]);
await sql(`INSERT INTO libraries (external_id, name, media_type) VALUES ('compatible-fixture', 'Synthetic compatibility', 'movie');
  INSERT INTO media_server_items (library_id, external_id, title, media_type, enrichment_status)
  SELECT id, 'compatible-fixture', 'Synthetic compatibility', 'movie', 'not_needed' FROM libraries WHERE external_id = 'compatible-fixture';
  INSERT INTO task_queue (task_type, payload, status) VALUES ('compatible_backfill_fixture', '{}', 'processing')`);
await assess('deferred'); // In-flight backfill cannot be consumed by the real pending-task worker.
assert.deepEqual(await sql('SELECT attempts, last_result FROM queue_vacuum_recovery_state'),
  [{ attempts: 0, last_result: 'waiting_for_platform_idle' }]);
await sql("DELETE FROM task_queue WHERE task_type = 'compatible_backfill_fixture'");
await assess('complete');
assert.deepEqual(await sql('SELECT attempts, last_result FROM queue_vacuum_recovery_state'), [{ attempts: 1, last_result: 'completed' }]);
await pressure();
await assess('deferred');
assert.deepEqual(await sql('SELECT attempts, last_result FROM queue_vacuum_recovery_state'), [{ attempts: 1, last_result: 'cooldown' }]);
assert.deepEqual(await sql('SELECT value FROM supervisor_sentinel'), [{ value: 'preserved' }]);
await sql('ALTER TABLE task_queue SET (autovacuum_vacuum_threshold=50,autovacuum_vacuum_insert_threshold=500)');
process.stdout.write('PASS compatible worker: healthy, fresh setup, backfill, repair and durable cooldown; shared identity unchanged\n');
