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

const pg = require('pg');
const { Pool } = pg;

// ─── Global int8 (bigint) type parser ─────────────────────────────────────────
// PostgreSQL's pg driver returns BIGINT (OID 20 / int8) columns as JavaScript
// *strings* by default to avoid precision loss for values > Number.MAX_SAFE_INTEGER
// (9,007,199,254,740,991). This is safe but breaks existing code/tests that expect
// numeric IDs.
//
// For primary key IDs (which are always incrementing integers well within JS safe
// range for any realistic deployment), we convert to JS number. Only pathological
// values > 2^53 fall back to string — in practice you'd need 9 quadrillion rows.
//
// This parser applies GLOBALLY to all Pool/Client instances in this process
// (pg.types is a singleton). The same parser is registered in
// server/src/__tests__/integration/setup.js so integration tests match.
//
// Defensive guard: test mocks may stub out the pg module without a `types` object.
if (pg.types && typeof pg.types.setTypeParser === 'function') {
  pg.types.setTypeParser(20, (val) => {
    if (val === null) return null;
    const num = parseInt(val, 10);
    // Preserve precision for values outside JS safe integer range
    return (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) ? val : num;
  });
}
// ──────────────────────────────────────────────────────────────────────────────

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
  // Explicit pool sizing — bumped to 15 to accommodate concurrent tasks each
  // holding a dedicated vector-search transaction client plus graph/text queries.
  // Override with POSTGRES_POOL_MAX env var.
  max: parseInt(process.env.POSTGRES_POOL_MAX) || 15,
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
 *
 * Security note: pg error messages can contain internal host/IP/database details
 * (e.g. "connect ECONNREFUSED 172.20.0.2:5432"). In production the error field is
 * replaced with a generic string so unauthenticated /health endpoints cannot disclose
 * internal network topology. The full message is preserved in development for debugging.
 */
async function healthCheck() {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return { healthy: true };
  } catch (err) {
    const errorMsg = process.env.NODE_ENV === 'production'
      ? 'Database connection failed'
      : err.message;
    return { healthy: false, error: errorMsg };
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
 * Backfill services (1001-1003) use transaction-scoped or session-scoped locks.
 * Scheduler jobs (2001+) use session-scoped locks via withSessionAdvisoryLock() so the
 * lock is held for the full duration of the job and released when it completes.
 * STARTUP_RESET uses a transaction-scoped lock (pg_try_advisory_xact_lock).
 */
const DB_ADVISORY_LOCKS = {
  IDLE_BACKFILL: 1001,
  SCHEDULED_BACKFILL: 1002,
  MANUAL_BACKFILL: 1003,
  STARTUP_RESET: 1234567890,
  // Scheduler job locks — prevent two processes from running the same job simultaneously
  // during rolling restarts (e.g. K8s maxSurge, docker compose up --no-deps).
  GAP_ANALYSIS: 2001,
  LIBRARY_SYNC: 2002,
  RETRY_QUEUE: 2003,
  ENRICHMENT_RETRY_QUEUE: 2004,
  RATING_NORMALIZATION_CHECK: 2005,
  STALE_CLEANUP: 2006,
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

/**
 * Prewarm HNSW vector indexes into shared_buffers after a PostgreSQL restart.
 *
 * After every restart, shared_buffers is empty. The HNSW indexes must be loaded
 * from disk before any ANN (approximate nearest-neighbour) search runs at full
 * speed. Calling this function at startup front-loads that I/O so the first
 * user-triggered RAG search is not disk-bound.
 *
 * Requires the pg_prewarm extension (migration 20260305_200200_enable_pg_prewarm).
 * Gracefully no-ops if the extension is not installed or the indexes don't exist yet
 * (e.g. before any embeddings have been generated).
 *
 * @returns {Promise<{loaded: boolean, blocks?: {text: number, image: number}, error?: string}>}
 */
async function prewarmHnswIndexes() {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(pg_prewarm('idx_embeddings_hnsw'),       0) AS text_blocks,
        COALESCE(pg_prewarm('idx_embeddings_image_hnsw'), 0) AS image_blocks
    `);
    const { text_blocks, image_blocks } = result.rows[0];
    return {
      loaded: true,
      blocks: {
        text:  parseInt(text_blocks,  10),
        image: parseInt(image_blocks, 10),
      },
    };
  } catch (err) {
    // pg_prewarm not installed, or indexes don't exist yet — not fatal.
    return { loaded: false, error: err.message };
  }
}

/**
 * Check whether pg_stat_statements is installed AND actively collecting data.
 *
 * The extension requires two independent conditions to be true:
 *   1. The migration has run and the extension row exists in pg_extension.
 *   2. 'pg_stat_statements' appears in shared_preload_libraries in postgresql.conf,
 *      meaning PostgreSQL was started with it loaded.  This only takes effect after
 *      a full container restart — installing the extension alone is not enough.
 *
 * Returns:
 *   { active: true }                    — extension is installed and collecting
 *   { active: false, reason: string }   — not collecting; reason explains why
 *
 * Used at startup to emit a one-time informational log so operators know whether
 * query profiling data is available in pg_stat_statements.
 *
 * @returns {Promise<{active: boolean, reason?: string}>}
 */
async function checkPgStatStatements() {
  try {
    // Check if the extension is installed (migration has run).
    const extResult = await pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
       ) AS installed`
    );
    if (!extResult.rows[0].installed) {
      return { active: false, reason: 'extension not installed — run pending migrations first' };
    }

    // Check if it is loaded in shared_preload_libraries (requires restart to activate).
    const settingResult = await pool.query(
      `SELECT setting FROM pg_settings WHERE name = 'shared_preload_libraries'`
    );
    const libraries = settingResult.rows[0]?.setting ?? '';
    if (!libraries.includes('pg_stat_statements')) {
      return {
        active: false,
        reason: 'extension installed but not loaded — recreate the container to activate shared_preload_libraries',
      };
    }

    return { active: true };
  } catch (err) {
    return { active: false, reason: err.message };
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
  prewarmHnswIndexes,
  checkPgStatStatements,
};
