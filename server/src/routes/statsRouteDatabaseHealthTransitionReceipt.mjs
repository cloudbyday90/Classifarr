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

import { databaseHealthTransitionReceiptLimiterConfig } from '../config/rateLimits.mjs';
import {
  createDatabaseHealthTransitionReceiptReadService,
} from '../services/databaseHealthTransitionReceiptReadService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers a parameter-free, administrator-only read of the latest confirmed
 * current-period receipt. It cannot write a receipt, alter the observer, or
 * expose historical, raw, library, policy, AI, media, provider, or routing data.
 */
export function registerDatabaseHealthTransitionReceiptRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createReceiptReadService = createDatabaseHealthTransitionReceiptReadService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Database health transition receipt requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Database health transition receipt requires a rate-limit factory.');
  }

  const receiptReadService = createReceiptReadService({ database: db });
  const receiptLimiter = rateLimit(databaseHealthTransitionReceiptLimiterConfig);

  router.get('/database-health-transition-receipt', requireAdmin, receiptLimiter, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (Object.keys(req.query || {}).length > 0) {
      throw new ValidationError('Database health transition receipt does not accept query parameters');
    }
    return sendData(res, await receiptReadService.getSummary());
  }));
}
