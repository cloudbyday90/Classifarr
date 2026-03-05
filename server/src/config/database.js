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

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  healthCheck,
};
