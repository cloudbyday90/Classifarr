/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { requireAdmin } from '../middleware/auth.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  requireHistoricRouteSafetyRefreshActorId,
} from './classificationRouteHistoricRouteSafetyRefreshActor.mjs';

export function registerHistoricRouteSafetyRefreshRecentReceiptRoute(router, {
  policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService,
} = {}) {
  if (typeof policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService?.run !== 'function') {
    throw new TypeError('Historic route-safety recent receipt route requires a discovery service.');
  }

  router.get('/pending/route-safety-refresh/receipts/recent', requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService.run({
        actorId: requireHistoricRouteSafetyRefreshActorId(req.user),
      });

      res.set('Cache-Control', 'no-store');
      res.json(result);
    }));
}
