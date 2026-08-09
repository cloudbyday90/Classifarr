/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import './env.mjs';
import pg from 'pg';
import { setTimeout as sleep } from 'node:timers/promises';
import { createLogger } from '../utils/logger.mjs';

function createSlowQueryThreshold(environment) {
  const parsedSlowQueryThreshold = environment.POSTGRES_SLOW_QUERY_THRESHOLD_MS !== undefined
    ? parseInt(environment.POSTGRES_SLOW_QUERY_THRESHOLD_MS, 10)
    : NaN;

  return Number.isFinite(parsedSlowQueryThreshold)
    ? parsedSlowQueryThreshold
    : 500;
}

function createConnectRetryConfig(environment) {
  const parsedRetries = parseInt(environment.POSTGRES_CONNECT_RETRIES, 10);
  const parsedDelay = parseInt(environment.POSTGRES_CONNECT_RETRY_DELAY_MS, 10);

  return {
    retries: Number.isFinite(parsedRetries) && parsedRetries >= 0 ? parsedRetries : 2,
    baseDelayMs: Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : 250,
  };
}

/**
 * Determines whether a failure to acquire a pooled connection is transient and
 * therefore safe to retry. Connection acquisition is idempotent, so retrying it
 * never risks re-running a non-idempotent query. Covers the pg pool
 * connection-timeout error ("Connection terminated due to connection timeout")
 * and the common transient network error codes.
 */
function isTransientConnectionError(error) {
  if (!error) return false;

  const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);
  if (typeof error.code === 'string' && transientCodes.has(error.code)) {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

function createPoolConfig(environment) {
  return {
    host: environment.POSTGRES_HOST || 'localhost',
    port: parseInt(environment.POSTGRES_PORT || '5432', 10),
    database: environment.POSTGRES_DB || 'classifarr',
    user: environment.POSTGRES_USER || 'classifarr',
    password: environment.POSTGRES_PASSWORD || 'classifarr_secret',
    max: parseInt(environment.POSTGRES_POOL_MAX, 10) || 15,
    connectionTimeoutMillis: parseInt(environment.POSTGRES_CONN_TIMEOUT_MS, 10) || 5000,
    idleTimeoutMillis: parseInt(environment.POSTGRES_IDLE_TIMEOUT_MS, 10) || 30000,
    statement_timeout: parseInt(environment.POSTGRES_STATEMENT_TIMEOUT_MS, 10) || 30000,
  };
}

export const DB_ADVISORY_LOCKS = {
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
  POLICY_ROLLBACK_SNAPSHOT_RETENTION: 2007,
  NATIVE_INTENT_RECONCILIATION: 2008,
  NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION: 2009,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION: 2010,
  POLICY_PROFILE_REFRESH_OUTBOX: 2011,
  TASK_QUEUE_MAINTENANCE: 2012,
};

export function createDatabaseModule({
  pgModule = pg,
  loggerFactory = createLogger,
  environment = process.env,
} = {}) {
  const { Pool } = pgModule;
  const logger = loggerFactory('database');
  const slowQueryThresholdMs = createSlowQueryThreshold(environment);
  const connectRetryConfig = createConnectRetryConfig(environment);

  if (pgModule.types && typeof pgModule.types.setTypeParser === 'function') {
    pgModule.types.setTypeParser(20, (val) => {
      if (val === null) return null;
      const num = parseInt(val, 10);
      return (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) ? val : num;
    });
  }

  const pool = new Pool(createPoolConfig(environment));

  if (typeof pool.on === 'function') {
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err.message });
    });
  }

  /**
   * Acquire a pooled client, retrying transient connection-acquisition failures
   * (e.g. "Connection terminated due to connection timeout" during a startup
   * burst or brief Postgres unavailability) with a short exponential backoff.
   * Only the idempotent connect step is retried; callers run their query once
   * on the returned client, so non-idempotent statements are never re-executed.
   */
  async function connectWithRetry() {
    let lastError;

    for (let attempt = 0; attempt <= connectRetryConfig.retries; attempt += 1) {
      try {
        return await pool.connect();
      } catch (error) {
        lastError = error;

        if (attempt === connectRetryConfig.retries || !isTransientConnectionError(error)) {
          throw error;
        }

        const delayMs = connectRetryConfig.baseDelayMs * Math.pow(2, attempt);
        logger.warn('Transient database connection failure - retrying acquisition', {
          attempt: attempt + 1,
          maxAttempts: connectRetryConfig.retries + 1,
          delayMs,
          error: error.message,
        }, { skipDbPersist: true });

        if (delayMs > 0) {
          // Use an unref'd timer so a pending backoff never keeps the process
          // (or a graceful shutdown / test teardown) alive waiting on a retry.
          await sleep(delayMs, undefined, { ref: false });
        }
      }
    }

    throw lastError;
  }

  async function healthCheck() {
    let client;
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      return { healthy: true };
    } catch (err) {
      const errorMsg = environment.NODE_ENV === 'production'
        ? 'Database connection failed'
        : err.message;
      return { healthy: false, error: errorMsg };
    } finally {
      if (client) client.release();
    }
  }

  async function query(text, params) {
    const startedAt = process.hrtime.bigint();
    let client;
    let poolWaitDurationMs = null;
    let executionDurationMs = null;

    try {
      if (typeof pool.connect === 'function') {
        const poolWaitStartedAt = process.hrtime.bigint();
        client = await connectWithRetry();
        poolWaitDurationMs = Number(process.hrtime.bigint() - poolWaitStartedAt) / 1e6;

        if (client && typeof client.query === 'function') {
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
      if (durationMs > slowQueryThresholdMs) {
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
    const client = await connectWithRetry();
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

  async function withSessionAdvisoryLock(lockKey, fn) {
    const client = await connectWithRetry();
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
        CASE
          WHEN to_regclass('public.idx_embeddings_hnsw') IS NOT NULL
          THEN COALESCE(pg_prewarm('public.idx_embeddings_hnsw'), 0)
          ELSE 0
        END AS text_blocks,
        CASE
          WHEN to_regclass('public.idx_embeddings_image_hnsw') IS NOT NULL
          THEN COALESCE(pg_prewarm('public.idx_embeddings_image_hnsw'), 0)
          ELSE 0
        END AS image_blocks
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
      const availableResult = await pool.query(
        `SELECT EXISTS(
         SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements'
       ) AS available`
      );
      const extensionAvailable = availableResult.rows[0].available;

      const settingResult = await pool.query(
        `SELECT setting FROM pg_settings WHERE name = 'shared_preload_libraries'`
      );
      const libraries = settingResult.rows[0]?.setting ?? '';

      const extResult = await pool.query(
        `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
       ) AS installed`
      );
      const extensionInstalled = extResult.rows[0].installed;
      if (!extensionAvailable) {
        return {
          active: false,
          reason: extensionInstalled
            ? 'extension is installed in the catalog but its runtime files are missing from this image'
            : 'extension runtime files are not available in this image',
        };
      }

      if (!libraries.includes('pg_stat_statements')) {
        return extensionInstalled
          ? {
              active: false,
              reason: 'extension installed but not loaded — recreate the container to activate shared_preload_libraries',
            }
          : {
              active: false,
              reason: 'extension available but not preloaded — startup will retry automatically after shared_preload_libraries is restored',
            };
      }

      if (!extResult.rows[0].installed) {
        return { active: false, reason: 'extension available but not installed yet — startup will retry automatically when preloaded' };
      }

      return { active: true };
    } catch (err) {
      return { active: false, reason: err.message };
    }
  }

  async function ensurePgStatStatements() {
    try {
      const status = await checkPgStatStatements();
      if (status.active) {
        return { ensured: false, reason: 'already active' };
      }

      if (status.reason?.includes('runtime files are not available')) {
        return { ensured: false, reason: status.reason };
      }

      if (status.reason?.includes('runtime files are missing')) {
        return { ensured: false, reason: status.reason };
      }

      if (status.reason?.includes('not loaded')) {
        return { ensured: false, reason: status.reason };
      }

      if (status.reason?.includes('not preloaded')) {
        return { ensured: false, reason: status.reason };
      }

      await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public`);
      return { ensured: true };
    } catch (err) {
      return { ensured: false, reason: err.message };
    }
  }

  return {
    pool,
    DB_ADVISORY_LOCKS,
    healthCheck,
    query,
    withTransaction,
    tryAdvisoryLock,
    withSessionAdvisoryLock,
    prewarmHnswIndexes,
    checkPgStatStatements,
    ensurePgStatStatements,
  };
}

const databaseModule = createDatabaseModule();

export const {
  pool,
  healthCheck,
  query,
  withTransaction,
  tryAdvisoryLock,
  withSessionAdvisoryLock,
  prewarmHnswIndexes,
  checkPgStatStatements,
  ensurePgStatStatements,
} = databaseModule;
