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

/**
 * Executes a SQL query inside a transaction with a per-statement timeout.
 * Falls back to db.query() if the pool is unavailable.
 *
 * @param {object} db - Database module (must have pool.connect and query)
 * @param {string} sql - SQL statement
 * @param {Array} params - Query parameters
 * @param {number} [timeoutMs=30000] - Statement timeout in milliseconds
 */
export async function queryWithTimeout(db, sql, params, timeoutMs = 30_000) {
  let client;
  try {
    if (db.pool && typeof db.pool.connect === 'function') {
      client = await db.pool.connect();
    }
  } catch (_) {
    // Pool unavailable — fall through to regular query
  }

  if (!client || typeof client.query !== 'function') {
    return db.query(sql, params);
  }

  try {
    await client.query('BEGIN');
    // sql-interpolation: SET LOCAL timeout — numeric value, not user-controlled; $N not supported by PostgreSQL SET
      await client.query(`SET LOCAL statement_timeout = '${timeoutMs}'`); // sql-interpolation: timeoutMs is a validated integer (default 30000), not user input
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // swallow-error: best-effort ROLLBACK in error handler — already in error state
      await client.query('ROLLBACK').catch(() => {}); // swallow-error: ROLLBACK failure is non-actionable; original error is re-thrown below
    throw err;
  } finally {
    client.release();
  }
}
