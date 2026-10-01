/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';

jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');
const { executeSemanticVectorSearch } = await import('../../services/ragRetrieverQuery.mjs');

function database({ Client = pg.Client, max = 2, user, password } = {}) {
  const config = getPool().options;
  return createDatabaseModule({ pgModule: { ...pg, Client },
    loggerFactory: () => ({ error: jest.fn(), warn: jest.fn() }),
    environment: { POSTGRES_HOST: config.host, POSTGRES_PORT: String(config.port), POSTGRES_DB: config.database,
      POSTGRES_USER: user ?? config.user, POSTGRES_PASSWORD: password ?? config.password, POSTGRES_POOL_MAX: String(max),
      POSTGRES_STATEMENT_TIMEOUT_MS: '30000', POSTGRES_CONN_TIMEOUT_MS: '1000' } });
}

async function waitForActive(marker) {
  const deadline = Date.now() + 5000;
  do {
    const result = await getPool().query(`SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND state = 'active' AND query LIKE $1`, [`%${marker}%`]);
    if (result.rows.length) return result.rows[0].pid;
    await sleep(10);
  } while (Date.now() < deadline);
  throw new Error('fixture_query_not_active');
}

async function waitForGone(pid) {
  const deadline = Date.now() + 3000;
  do {
    const result = await getPool().query('SELECT 1 FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (!result.rows.length) return;
    await sleep(10);
  } while (Date.now() < deadline);
  throw new Error('aborted_backend_still_present');
}

test('control reproduces the old boundary: aborting the caller alone leaves SQL active', async () => {
  const db = database(), controller = new AbortController();
  try {
    const pending = db.withTransaction(client => client.query('SELECT pg_sleep(0.3) /* cancellation_baseline */'));
    const pid = await waitForActive('cancellation_baseline'); controller.abort();
    const state = await getPool().query('SELECT state FROM pg_stat_activity WHERE pid = $1', [pid]);
    expect(state.rows[0].state).toBe('active');
    await pending;
  } finally { await db.pool.end(); }
});

test('active SQL cancellation does not interrupt a concurrent reader and the work pool recovers', async () => {
  const db = database(), controller = new AbortController();
  try {
    const pending = db.withTransaction(client => client.query('SELECT pg_sleep(10) /* cancellation_target */'),
      { signal: controller.signal, readOnly: true });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError', code: 'ABORT_ERR' });
    const pid = await waitForActive('cancellation_target');
    const unaffected = db.query('SELECT pg_sleep(0.4), 7 AS ok /* cancellation_unrelated */');
    await waitForActive('cancellation_unrelated');
    const start = performance.now(); controller.abort('private caller reason');
    await rejected; await waitForGone(pid);
    expect(performance.now() - start).toBeLessThan(3000);
    expect((await unaffected).rows[0].ok).toBe(7);
    expect((await db.query('SELECT 42 AS ok')).rows[0].ok).toBe(42);
    expect(db.pool.waitingCount).toBe(0);
  } finally { await db.pool.end(); }
});

test('server statement deadline stops SQL when control connections are unavailable', async () => {
  class UnavailableClient { constructor() { throw new Error('fixture control unavailable'); } }
  const db = database({ Client: UnavailableClient }), controller = new AbortController();
  try {
    const pending = db.withTransaction(client => client.query('SELECT pg_sleep(10) /* cancellation_fallback */'),
      { signal: controller.signal, readOnly: true, timeoutMs: 500 });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const pid = await waitForActive('cancellation_fallback'); controller.abort();
    await rejected; await waitForGone(pid);
    expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  } finally { await db.pool.end(); }
});

test('an ordinary login cancels its own active query without pg_signal_backend or superuser', async () => {
  const role = `read_cancel_${randomUUID().replaceAll('-', '')}`;
  // Synthetic credentials and role exist only on the integration container.
  await getPool().query(`CREATE ROLE ${role} LOGIN PASSWORD 'fixture-only' NOSUPERUSER`);
  const db = database({ user: role, password: 'fixture-only' }), controller = new AbortController();
  try {
    const grants = (await db.query("SELECT rolsuper, pg_has_role(current_user, 'pg_signal_backend', 'MEMBER') AS signal_grant FROM pg_roles WHERE rolname = current_user")).rows[0];
    expect(grants).toEqual({ rolsuper: false, signal_grant: false });
    const pending = db.withTransaction(client => client.query('SELECT pg_sleep(10) /* cancellation_unprivileged */'),
      { signal: controller.signal, readOnly: true });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const pid = await waitForActive('cancellation_unprivileged'); controller.abort();
    await rejected; await waitForGone(pid);
    expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  } finally { await db.pool.end(); await getPool().query(`DROP ROLE ${role}`); }
});

test('concurrent callers each cancel only their own session', async () => {
  const db = database(), first = new AbortController(), second = new AbortController();
  try {
    const run = (controller, marker) => db.withTransaction(c => c.query(`SELECT pg_sleep(10) /* ${marker} */`),
      { signal: controller.signal, readOnly: true });
    const a = run(first, 'cancellation_pair_a'), b = run(second, 'cancellation_pair_b');
    const assertions = [expect(a).rejects.toMatchObject({ name: 'AbortError' }), expect(b).rejects.toMatchObject({ name: 'AbortError' })];
    const pids = await Promise.all([waitForActive('cancellation_pair_a'), waitForActive('cancellation_pair_b')]);
    expect(pids[0]).not.toBe(pids[1]); first.abort(); second.abort();
    await Promise.all(assertions); await Promise.all(pids.map(waitForGone));
    expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  } finally { await db.pool.end(); }
});

test('saturated pool abort never starts work after a later connection grant', async () => {
  const db = database({ max: 1 }), controller = new AbortController();
  const held = await db.pool.connect(), callback = jest.fn();
  try {
    const pending = db.withTransaction(callback, { signal: controller.signal, readOnly: true });
    controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  } finally { held.release(); }
  try {
    expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
    expect(callback).not.toHaveBeenCalled(); expect(db.pool.waitingCount).toBe(0);
  } finally { await db.pool.end(); }
});

test('read-only success restores local settings, rejects writes, and cannot be cancelled after reuse', async () => {
  const db = database({ max: 1 }), controller = new AbortController();
  try {
    const result = await db.withTransaction(client => client.query("SELECT current_setting('transaction_read_only') AS read_only, pg_backend_pid() AS pid"),
      { signal: controller.signal, readOnly: true, timeoutMs: 500 });
    expect(result.rows[0].read_only).toBe('on'); controller.abort();
    const next = await db.query("SELECT pg_sleep(0.05), pg_backend_pid() AS pid, current_setting('statement_timeout') AS deadline");
    expect(next.rows[0]).toEqual({ pg_sleep: '', pid: result.rows[0].pid, deadline: '30s' });
    await expect(db.withTransaction(c => c.query('CREATE TABLE forbidden_cancellation_write (id int)'),
      { signal: new AbortController().signal, readOnly: true })).rejects.toMatchObject({ code: '25006' });
  } finally { await db.pool.end(); }
});

test('real production semantic executor receives cancellation while its table read waits', async () => {
  const db = database(), controller = new AbortController(), blocker = await getPool().connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE classification_embeddings IN ACCESS EXCLUSIVE MODE');
    const pending = executeSemanticVectorSearch(db, { vectorString: `[${Array(768).fill(0.1).join(',')}]`,
      imageVectorString: null, textWeight: 1, imageWeight: 0, candidateLimit: 50, limit: 5, signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const pid = await waitForActive('FROM classification_embeddings ce');
    controller.abort(); await rejected; await waitForGone(pid);
    expect(db.pool.waitingCount).toBe(0);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end(); }
});
