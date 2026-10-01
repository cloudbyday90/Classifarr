/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { observeEmbeddedChild, waitForEmbeddedExit } from '../../bootstrap/embeddedChildProcess.mjs';
import { createCompatibleImageIndexBroker } from '../../bootstrap/embeddedCompatibleImageIndex.mjs';
import { inspectImageIndexes } from '../../services/imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES } from '../../services/imageIndexMaintenanceContract.mjs';

assert.equal(process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL, 'disposable-v1');
assert.equal(process.platform, 'linux'); assert(process.getuid() > 0);
assert.equal(process.argv.length, 2);
assert.deepEqual(await readdir('/sys/class/net'), ['lo']);
const mounts = await readFile('/proc/self/mountinfo', 'utf8');
assert(mounts.split('\n').some(line => line.split(' ')[4] === '/app/data'));
const pool = new pg.Pool({ host: 'localhost', port: 5432, user: 'classifarr', database: 'classifarr',
  max: 3, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
const sql = (...args) => pool.query(...args);
async function until(check) {
  for (let n = 0; n < 300; n++) { if (await check()) return; await delay(100); }
  throw new Error('image_index_probe_timeout');
}
const program = `import assert from 'node:assert/strict';
import { openImageIndexHandoff } from '/app/src/services/imageIndexHandoffClient.mjs';
const handoff = openImageIndexHandoff(); assert(handoff);
const keepAlive = setTimeout(() => { process.exitCode = 1; handoff.close(); }, 145000);
try { assert.equal((await handoff.request(JSON.parse(process.argv[1]))).status, process.argv[2]); }
finally { clearTimeout(keepAlive); handoff.close(); }`;
async function execute(task, expected, interrupt) {
  const child = spawn('/usr/local/bin/node', ['--input-type=module', '-e', program, JSON.stringify(task), expected], {
    cwd: '/app', shell: false, env: { CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' },
    stdio: ['ignore', 'inherit', 'inherit', 'ignore', 'pipe'],
  });
  const runtime = observeEmbeddedChild(child);
  const broker = createCompatibleImageIndexBroker({ channel: child.stdio[4], onFatal: () => runtime.signal('SIGKILL') });
  try {
    if (interrupt) { await interrupt(); await broker.stop(); }
    assert.deepEqual(await waitForEmbeddedExit(runtime.done, 145_000), { code: 0, signal: null });
  } finally {
    await broker.stop();
    if (!runtime.hasExited()) { runtime.signal('SIGKILL'); await waitForEmbeddedExit(runtime.done, 2000); }
  }
}
async function claim() {
  return (await sql(`INSERT INTO task_queue (task_type, payload, status, claim_token, visible_at, started_at)
    VALUES ('rebuild_hnsw_index', '{"sql":"untrusted-ignored"}', 'processing', gen_random_uuid(),
      clock_timestamp() + INTERVAL '5 minutes', NOW()) RETURNING id::text, claim_token`)).rows[0];
}
const status = async task => (await sql('SELECT status, claim_token, attempts FROM task_queue WHERE id = $1', [task.id])).rows[0];
async function clearIndexes() { for (const index of IMAGE_INDEXES) await sql(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS')); }

try {
  assert.deepEqual((await sql('SELECT value FROM supervisor_sentinel')).rows, [{ value: 'preserved' }]);
  assert.equal((await sql('SELECT count(*)::int AS count FROM libraries')).rows[0].count, 0);
  await clearIndexes();
  const task = await claim();
  await execute({ ...task, claim_token: randomUUID() }, 'deferred');
  assert.equal((await status(task)).claim_token, task.claim_token);
  assert((await inspectImageIndexes(sql)).every(value => value.action === 'create'));
  // Keep synthetic claims live until retired: the real app can reclaim expired work.
  const quarantined = await claim();
  await sql("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'requires_maintenance' WHERE gate_id = 1");
  await execute(quarantined, 'deferred');
  assert.equal((await status(quarantined)).claim_token, quarantined.claim_token);
  await sql("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'ready' WHERE gate_id = 1");
  // Retire only synthetic claims so the real app cannot race the interrupted-build fixture.
  await sql("UPDATE task_queue SET status = 'completed', claim_token = NULL, visible_at = NULL WHERE id = ANY($1::integer[])", [[task.id, quarantined.id]]);

  await clearIndexes();
  const interrupted = await claim(), writer = await pool.connect();
  try {
    await writer.query('BEGIN');
    await writer.query('LOCK TABLE classification_embeddings IN ROW EXCLUSIVE MODE');
    await execute(interrupted, 'unavailable', async () => {
      await until(async () => (await sql("SELECT to_regclass('public.idx_embeddings_image_hnsw') AS index")).rows[0].index !== null);
    });
    // Node exit does not prove a PostgreSQL statement has observed disconnect.
    // Keep the writer blocker until the existing SQL lock timeout cancels the build.
    await until(async () => (await sql("SELECT count(*)::int AS count FROM pg_stat_activity WHERE query = $1 AND state = 'active'",
      [IMAGE_INDEXES[0].create])).rows[0].count === 0);
  } finally { await writer.query('ROLLBACK'); writer.release(true); }
  assert.equal((await status(interrupted)).claim_token, interrupted.claim_token);
  assert.equal((await inspectImageIndexes(sql))[0].action, 'repair');
  // Rotate ownership: the interrupted worker must never acknowledge its replacement.
  const replacement = (await sql('UPDATE task_queue SET claim_token = gen_random_uuid() WHERE id = $1 RETURNING id::text, claim_token', [interrupted.id])).rows[0];
  await execute(interrupted, 'deferred');
  await execute(replacement, 'complete');
  assert.equal((await status(replacement)).status, 'completed');
  assert((await inspectImageIndexes(sql)).every(value => value.action === 'preserve'));

  // Exercise the real application's queue -> FD4 -> supervisor -> worker composition.
  const queued = (await sql(`INSERT INTO task_queue (task_type, payload, next_retry_at)
    VALUES ('rebuild_hnsw_index', '{}', NOW()) RETURNING id::text`)).rows[0];
  await until(async () => (await status(queued)).status === 'completed');
  assert.equal((await status(queued)).attempts, 0);
  assert.deepEqual((await sql('SELECT value FROM supervisor_sentinel')).rows, [{ value: 'preserved' }]);
  process.stdout.write('PASS image worker: stale claim, restore quarantine, killed build, invalid-index recovery and real queued completion\n');
} finally { await pool.end(); }
