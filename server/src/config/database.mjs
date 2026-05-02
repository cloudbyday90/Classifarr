/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import database from './database.shared.js';

export const query = database.query;
export const pool = database.pool;
export const healthCheck = database.healthCheck;
export const withTransaction = database.withTransaction;
export const tryAdvisoryLock = database.tryAdvisoryLock;
export const withSessionAdvisoryLock = database.withSessionAdvisoryLock;
export const DB_ADVISORY_LOCKS = database.DB_ADVISORY_LOCKS;
export const prewarmHnswIndexes = database.prewarmHnswIndexes;
export const checkPgStatStatements = database.checkPgStatStatements;
export default database;
