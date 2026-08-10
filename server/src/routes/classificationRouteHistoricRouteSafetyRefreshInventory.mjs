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
  normalizeHistoricRouteSafetyRefreshInventoryOptions,
} from '../services/policyRuntimeHistoricRouteSafetyRefreshInventory.mjs';

export function registerHistoricRouteSafetyRefreshInventoryRoute(router, {
  policyRuntimeHistoricRouteSafetyRefreshInventoryService,
} = {}) {
  if (typeof policyRuntimeHistoricRouteSafetyRefreshInventoryService?.run !== 'function') {
    throw new TypeError('Historic route-safety refresh inventory route requires an inventory service.');
  }

  router.get('/pending/route-safety-refresh-inventory', requireAdmin, asyncHandler(async (req, res) => {
    const inventory = await policyRuntimeHistoricRouteSafetyRefreshInventoryService.run(
      normalizeHistoricRouteSafetyRefreshInventoryOptions({
        cursor: req.query?.cursor,
        limit: req.query?.limit,
      }),
    );

    res.set('Cache-Control', 'no-store');
    res.json(inventory);
  }));
}
