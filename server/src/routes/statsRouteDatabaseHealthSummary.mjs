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

import { databaseHealthSummaryLimiterConfig } from '../config/rateLimits.mjs';
import { createDatabaseHealthSummaryService } from '../services/databaseHealthSummaryService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers a fixed, administrator-authorized database statistics summary.
 * This parameter-free observation cannot expose operational dimensions or
 * trigger database maintenance, configuration, policy, AI, or routing work.
 */
export function registerDatabaseHealthSummaryRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createHealthSummaryService = createDatabaseHealthSummaryService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Database health summary requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Database health summary requires a rate-limit factory.');
  }

  const healthSummaryService = createHealthSummaryService({ database: db });
  const healthSummaryLimiter = rateLimit(databaseHealthSummaryLimiterConfig);

  router.get('/database-health-summary', requireAdmin, healthSummaryLimiter, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (Object.keys(req.query || {}).length > 0) {
      throw new ValidationError('Database health summary does not accept query parameters');
    }
    return sendData(res, await healthSummaryService.getSummary());
  }));
}
