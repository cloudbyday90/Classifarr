/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { checkAbort } from './abortUtils.mjs';
import { createDatabaseClientLease } from './databaseClientLease.mjs';

const MAX_READ_MS = 15000;

/** A read-only boundary; deliberately not the transaction runner for writes. */
export async function runAbortableDatabaseRead({ connect, cancelRead, logger, assertActive }, callback,
  { signal, timeoutMs = MAX_READ_MS }) {
  checkAbort(signal, 'database read');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_READ_MS) {
    throw new RangeError('database_read_timeout_invalid');
  }
  assertActive();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal.addEventListener('abort', forwardAbort, { once: true });
  const timer = setTimeout(forwardAbort, timeoutMs);
  const started = performance.now();
  let lease, identity, closed = false, rejectAbort;
  const aborted = new Promise((resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => {
    try { checkAbort(controller.signal, 'database read'); } catch (error) { rejectAbort(error); }
  };
  controller.signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) forwardAbort();
  const assertReadable = () => {
    checkAbort(controller.signal, 'database read');
    if (closed) throw new Error('database_read_closed');
    lease?.assertHealthy();
    assertActive();
  };
  const operation = (async () => {
    const client = await connect();
    // Acquisition cannot be removed from pg's queue. A late grant is returned
    // without starting a transaction; the caller has already received AbortError.
    if (closed || controller.signal.aborted) {
      client.release();
      checkAbort(controller.signal, 'database read');
    }
    lease = createDatabaseClientLease(client, { operation: 'abortable_read', logger });
    const query = async (...args) => {
      assertReadable();
      const result = await client.query(...args);
      assertReadable();
      return result;
    };
    await query('BEGIN READ ONLY');
    const remainingMs = Math.max(1, Math.ceil(timeoutMs - (performance.now() - started)));
    const settings = await query(`
      SELECT pid, backend_start::text AS started,
        set_config('statement_timeout', LEAST($1::integer,
          COALESCE(NULLIF((SELECT setting::integer FROM pg_settings
            WHERE name = 'statement_timeout'), 0), $1::integer))::text, true)
      FROM pg_stat_activity WHERE pid = pg_backend_pid()
    `, [remainingMs]);
    identity = settings.rows[0];
    if (!Number.isInteger(identity?.pid) || typeof identity?.started !== 'string') {
      throw new Error('database_read_identity_unavailable');
    }
    const result = await callback({ query }, { signal: controller.signal });
    await query('COMMIT');
    return result;
  })();
  let succeeded = false;
  try {
    const result = await Promise.race([operation, aborted]);
    assertReadable();
    succeeded = true;
    return result;
  } catch (error) {
    if (error?.code === '57014') forwardAbort();
    checkAbort(controller.signal, 'database read');
    throw error;
  } finally {
    closed = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', forwardAbort);
    controller.signal.removeEventListener('abort', onAbort);
    // Pin the target until control work settles. Never roll back/commit or reuse
    // this connection while a delayed cancellation may still reach the server.
    try {
      if (controller.signal.aborted && identity) await cancelRead(identity);
    } finally {
      lease?.release(!succeeded);
    }
  }
}
