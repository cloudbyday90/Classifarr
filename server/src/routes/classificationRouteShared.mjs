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

import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { registerHistoryRoutes } from './classificationRouteHistory.mjs';
import { registerSecondPassRoute } from './classificationRouteSecondPass.mjs';
import { registerCorrectionRoutes } from './classificationRouteCorrections.mjs';
import { registerExactItemMemoryRoutes } from './classificationRouteExactItemMemory.mjs';
import { registerPendingRoutes } from './classificationRoutePending.mjs';
import {
  registerPendingQuestionCleanupInventoryRoute,
} from './classificationRoutePendingCleanupInventory.mjs';
import {
  registerPendingQuestionCleanupApplyRoute,
} from './classificationRoutePendingCleanupApply.mjs';
import {
  registerHistoricRouteSafetyRefreshInventoryRoute,
} from './classificationRouteHistoricRouteSafetyRefreshInventory.mjs';
import {
  registerHistoricRouteSafetyRefreshExecutionRoute,
} from './classificationRouteHistoricRouteSafetyRefreshExecution.mjs';
import {
  registerHistoricRouteSafetyRefreshReceiptRoute,
} from './classificationRouteHistoricRouteSafetyRefreshReceipt.mjs';

export function createClassificationRouter({
  express,
  db,
  classificationService,
  classificationRetryService,
  clarificationService,
  createLogger,
  requireReadWrite,
  STALE_AWAITING_DECISION_DAYS,
  reclassificationService,
  policyRuntimeExactItemMemoryCommandService,
  policyRuntimePendingQuestionCleanupInventoryService,
  policyRuntimePendingQuestionCleanupApplyService,
  policyRuntimeHistoricRouteSafetyRefreshInventoryService,
  policyRuntimeHistoricRouteSafetyRefreshExecutionService,
  policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService,
}) {
  const router = express.Router();
  const logger = createLogger('classification');

  router.post('/classify', asyncHandler(async (req, res) => {
    const { tmdb_id, media_type, title } = req.body;

    if (!tmdb_id || !media_type) {
      throw new ValidationError('tmdb_id and media_type are required');
    }

    const payload = {
      media: {
        media_type,
        tmdbId: tmdb_id,
      },
      subject: title || `${media_type === 'movie' ? 'Movie' : 'TV Show'} Request`,
    };

    const result = await classificationService.classify(payload);
    res.json(result);
  }));

  registerHistoryRoutes(router, { db });
  registerSecondPassRoute(router, { db });
  registerCorrectionRoutes(router, {
    db,
    reclassificationService,
    logger,
    requireReadWrite,
  });
  registerExactItemMemoryRoutes(router, {
    db,
    logger,
    requireReadWrite,
    policyRuntimeExactItemMemoryCommandService,
  });
  registerPendingRoutes(router, { db, clarificationService, classificationService, STALE_AWAITING_DECISION_DAYS, logger });
  if (policyRuntimePendingQuestionCleanupInventoryService) {
    registerPendingQuestionCleanupInventoryRoute(router, {
      policyRuntimePendingQuestionCleanupInventoryService,
    });
  }
  if (policyRuntimePendingQuestionCleanupApplyService) {
    registerPendingQuestionCleanupApplyRoute(router, {
      policyRuntimePendingQuestionCleanupApplyService,
      requireReadWrite,
    });
  }
  if (policyRuntimeHistoricRouteSafetyRefreshInventoryService) {
    registerHistoricRouteSafetyRefreshInventoryRoute(router, {
      policyRuntimeHistoricRouteSafetyRefreshInventoryService,
    });
  }
  if (policyRuntimeHistoricRouteSafetyRefreshExecutionService) {
    registerHistoricRouteSafetyRefreshExecutionRoute(router, {
      policyRuntimeHistoricRouteSafetyRefreshExecutionService,
      requireReadWrite,
    });
  }
  if (policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService) {
    registerHistoricRouteSafetyRefreshReceiptRoute(router, {
      policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService,
    });
  }

  router.post('/retry', requireReadWrite, asyncHandler(async (req, res) => {
    const { classificationIds, options = {} } = req.body || {};

    if (!Array.isArray(classificationIds)) {
      throw new ValidationError('classificationIds must be an array');
    }
    if (classificationIds.length === 0) {
      throw new ValidationError('classificationIds must contain at least one id');
    }
    if (classificationIds.length > 100) {
      throw new ValidationError('classificationIds exceeds maximum batch size (100)');
    }
    if (!classificationIds.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
      throw new ValidationError('classificationIds must contain only positive integers');
    }
    if (options?.purgeLearning === true) {
      throw new ValidationError(
        'Retry does not purge learning evidence; use an authorized evidence command instead',
      );
    }

    const actor = req.user?.username || req.user?.email || req.user?.id || 'admin';
    const correlationId = randomUUID();

    const result = await classificationRetryService.retryClassifications({
        classificationIds,
        actor,
        correlationId,
      });

      res.json({
        success: result.failed === 0,
        ...result,
      });
  }));

  return router;
}
