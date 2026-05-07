/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Resolves the query executor for database operations.
 *
 * Service methods that participate in caller-managed transactions accept an
 * optional `client` parameter. When a transaction client is provided it takes
 * precedence over the default database connection so all queries run within the
 * same transaction. When no client is present the default `db` connection is
 * used and each query executes in its own implicit transaction.
 *
 * @param {import('pg').PoolClient|null|undefined} client - Optional transaction client
 * @param {object} db - Default database connection (must expose a `.query()` method)
 * @returns {object} The executor to use for subsequent queries
 */
export function resolveExecutor(client, db) {
  return client ?? db;
}
