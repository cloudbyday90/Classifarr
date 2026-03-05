/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { Pool } = require('pg');

const parsedSlowQueryThreshold = process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS !== undefined
  ? parseInt(process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS, 10)
  : NaN;

const SLOW_QUERY_THRESHOLD_MS = Number.isFinite(parsedSlowQueryThreshold)
  ? parsedSlowQueryThreshold
  : 500;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'classifarr',
  user: process.env.POSTGRES_USER || 'classifarr',
  password: process.env.POSTGRES_PASSWORD || 'classifarr_secret',
  // Explicit pool sizing — default pg value is 10, but make it tunable
  max: parseInt(process.env.POSTGRES_POOL_MAX) || 10,
  // Fail fast if pool is exhausted rather than hanging indefinitely
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONN_TIMEOUT_MS) || 5000,
  // Release idle connections after 30s (important for embedded/Docker deployments)
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS) || 30000,
  // Kill runaway queries rather than holding a connection forever (30s)
  statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT_MS) || 30000,
});

pool.on('error', (err) => {
  // Log the error but don't crash - the pool will recover
  // Transient connection errors are common and shouldn't kill the process
  console.error('Unexpected error on idle client', err);
});

/**
 * Lightweight health check — used by /health endpoints.
 * Uses a pooled client and consumes a pool slot only for the brief duration of the check.
 */
async function healthCheck() {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return { healthy: true };
  } catch (err) {
    return { healthy: false, error: err.message };
  } finally {
    if (client) client.release();
  }
}

/**
 * Timed query wrapper — logs slow queries that exceed POSTGRES_SLOW_QUERY_THRESHOLD_MS.
 * Uses process.hrtime.bigint() for nanosecond precision.
 */
async function timedQuery(text, params) {
  const start = process.hrtime.bigint();
  try {
    return await pool.query(text, params);
  } finally {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      const truncated = typeof text === 'string' ? text.slice(0, 120).replace(/\s+/g, ' ').trim() : '[non-string]';
      console.warn(`[SLOW QUERY] ${durationMs.toFixed(2)}ms — ${truncated}`);
    }
  }
}

/**
 * Execute `fn(client)` inside a BEGIN/COMMIT transaction.
 * Always releases the client in finally. Re-throws after ROLLBACK.
 *
 * @param {function} fn - async function that receives a pg PoolClient
 * @returns {Promise<*>} result of fn
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Log rollback failure but still throw original error
      console.error('Failed to rollback transaction', {
        rollbackError: rollbackErr,
        originalError: error,
      });
      console.error('Failed to rollback transaction', {
        rollbackError: rollbackErr,
        originalError: error,
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Attempt to acquire a transaction-scoped advisory lock.
 * Must be called INSIDE an active transaction (BEGIN already issued).
 * Lock is automatically released when the transaction commits or rolls back.
 *
 * @param {object} client - active pooled client with an open transaction
 * @param {number} lockKey - integer lock key (unique per service)
 * @returns {Promise<boolean>} true if lock acquired, false if already held
 */
async function tryAdvisoryLock(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey]
  );
  return result.rows[0].acquired === true;
}

/**
 * Advisory lock key constants — one per service that needs distributed startup protection.
 */
const DB_ADVISORY_LOCKS = {
  IDLE_BACKFILL: 1001,
  SCHEDULED_BACKFILL: 1002,
  MANUAL_BACKFILL: 1003,
};

/**
 * Execute `fn()` while holding a session-level advisory lock for the full duration.
 * Unlike the transaction-scoped pg_try_advisory_xact_lock used in tryAdvisoryLock(),
 * this lock is held on a dedicated client until fn() resolves — surviving COMMIT/ROLLBACK.
 * The lock is explicitly released with pg_advisory_unlock() in a finally block.
 *
 * @param {number} lockKey - integer lock key (from DB_ADVISORY_LOCKS)
 * @param {function} fn - async function to execute while lock is held
 * @returns {Promise<boolean>} true if lock was acquired (fn was called), false otherwise
 */
async function withSessionAdvisoryLock(lockKey, fn) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockKey]
    );
    if (!rows[0].acquired) {
      return false;
    }
    try {
      await fn();
      return true;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }
  } finally {
    client.release();
  }
}

module.exports = {
  query: timedQuery,
  pool,
  healthCheck,
  withTransaction,
  tryAdvisoryLock,
  withSessionAdvisoryLock,
  DB_ADVISORY_LOCKS,
};
