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

import * as db from '../config/database.mjs';
import {
  buildDatabaseHealthTransitionReceiptSummary,
} from './databaseHealthTransitionReceipt.mjs';
import {
  loadLatestCurrentDatabaseHealthTransitionReceipt,
} from './databaseHealthTransitionReceiptRepository.mjs';

/**
 * Reads one current-period, append-only transition receipt. The read is
 * intentionally parameter-free and cannot observe or disclose stale pre-reset
 * history, raw counts, or any application dimension.
 */
export function createDatabaseHealthTransitionReceiptReadService({
  database = db,
  loadLatestReceipt = loadLatestCurrentDatabaseHealthTransitionReceipt,
  buildSummary = buildDatabaseHealthTransitionReceiptSummary,
} = {}) {
  if (!database || typeof database.withTransaction !== 'function') {
    throw new TypeError('Database health transition receipt read requires a transaction-capable database.');
  }
  if (typeof loadLatestReceipt !== 'function' || typeof buildSummary !== 'function') {
    throw new TypeError('Database health transition receipt read requires receipt readers.');
  }

  return Object.freeze({
    async getSummary() {
      return database.withTransaction(async (client) => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        return buildSummary(await loadLatestReceipt(client));
      });
    },
  });
}
