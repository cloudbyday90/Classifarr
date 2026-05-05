/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import pg from 'pg';
import { createLogger } from '../utils/logger.mjs';

const { Pool } = pg;

const logger = createLogger('database');

if (pg.types && typeof pg.types.setTypeParser === 'function') {
  pg.types.setTypeParser(20, (val) => {
    if (val === null) return null;
    const num = parseInt(val, 10);
    return (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) ? val : num;
  });
}

const parsedSlowQueryThreshold = process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS !== undefined
  ? parseInt(process.env.POSTGRES_SLOW_QUERY_THRESHOLD_MS, 10)
  : NaN;

const SLOW_QUERY_THRESHOLD_MS = Number.isFinite(parsedSlowQueryThreshold)
  ? parsedSlowQueryThreshold
  : 500;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'classifarr',
  user: process.env.POSTGRES_USER || 'classifarr',
  password: process.env.POSTGRES_PASSWORD || 'classifarr_secret',
  max: parseInt(process.env.POSTGRES_POOL_MAX, 10) || 15,
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONN_TIMEOUT_MS, 10) || 5000,
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS, 10) || 30000,
  statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT_MS, 10) || 30000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err.message });
});

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

async function timedQuery(text, params) {
  const startedAt = process.hrtime.bigint();
  let client;
  let _usedDedicatedClient = false;
  let poolWaitDurationMs = null;
  let executionDurationMs = null;

  try {
    if (typeof pool.connect === 'function') {
      const poolWaitStartedAt = process.hrtime.bigint();
      client = await pool.connect();
      poolWaitDurationMs = Number(process.hrtime.bigint() - poolWaitStartedAt) / 1e6;

      if (client && typeof client.query === 'function') {
        _usedDedicatedClient = true;
        const executionStartedAt = process.hrtime.bigint();
        try {
          return await client.query(text, params);
        } finally {
          executionDurationMs = Number(process.hrtime.bigint() - executionStartedAt) / 1e6;
        }
      }
    }

    const executionStartedAt = process.hrtime.bigint();
    try {
      return await pool.query(text, params);
    } finally {
      executionDurationMs = Number(process.hrtime.bigint() - executionStartedAt) / 1e6;
    }
  } finally {
    if (client && typeof client.release === 'function') {
      client.release();
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      const truncated = typeof text === 'string' ? text.slice(0, 120).replace(/\s+/g, ' ').trim() : '[non-string]';
      const hasPoolCounters =
        Number.isFinite(pool.totalCount) &&
        Number.isFinite(pool.idleCount) &&
        Number.isFinite(pool.waitingCount);
      const timingSegments = [
        `total=${durationMs.toFixed(2)}ms`,
        Number.isFinite(poolWaitDurationMs) ? `poolWait=${poolWaitDurationMs.toFixed(2)}ms` : null,
        Number.isFinite(executionDurationMs) ? `exec=${executionDurationMs.toFixed(2)}ms` : null,
      ].filter(Boolean).join(' ');
      const poolSuffix = hasPoolCounters
        ? ` [pool total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}]`
        : '';
      logger.warn(
        `[SLOW QUERY] ${timingSegments} — ${truncated}${poolSuffix}`,
        hasPoolCounters
          ? {
            durationMs,
            poolWaitDurationMs,
            executionDurationMs,
            poolTotalCount: pool.totalCount,
            poolIdleCount: pool.idleCount,
            poolWaitingCount: pool.waitingCount,
          }
          : {
            durationMs,
            poolWaitDurationMs,
            executionDurationMs,
          },
        { skipDbPersist: true }
      );
    }
  }
}

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
      logger.error('Failed to rollback transaction', {
        rollbackError: rollbackErr.message,
        originalError: error.message,
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

async function tryAdvisoryLock(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey]
  );
  return result.rows[0].acquired === true;
}

const DB_ADVISORY_LOCKS = {
  IDLE_BACKFILL: 1001,
  SCHEDULED_BACKFILL: 1002,
  MANUAL_BACKFILL: 1003,
  BACKFILL_OWNER: 1004,
  EMBEDDING_PROVIDER_PROBE: 1005,
  STARTUP_RESET: 1234567890,
  GAP_ANALYSIS: 2001,
  LIBRARY_SYNC: 2002,
  RETRY_QUEUE: 2003,
  ENRICHMENT_RETRY_QUEUE: 2004,
  RATING_NORMALIZATION_CHECK: 2005,
  STALE_CLEANUP: 2006,
};

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
        text: parseInt(text_blocks, 10),
        image: parseInt(image_blocks, 10),
      },
    };
  } catch (err) {
    return { loaded: false, error: err.message };
  }
}

async function checkPgStatStatements() {
  try {
    const extResult = await pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
       ) AS installed`
    );
    if (!extResult.rows[0].installed) {
      return { active: false, reason: 'extension not installed — run pending migrations first' };
    }

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

const database = {
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

export { timedQuery as query, pool, healthCheck, withTransaction, tryAdvisoryLock, withSessionAdvisoryLock, DB_ADVISORY_LOCKS, prewarmHnswIndexes, checkPgStatStatements };
export default database;
