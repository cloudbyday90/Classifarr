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

export function registerPendingQuestionCleanupInventoryRoute(router, {
  policyRuntimePendingQuestionCleanupInventoryService,
} = {}) {
  if (typeof policyRuntimePendingQuestionCleanupInventoryService?.run !== 'function') {
    throw new TypeError('Pending-question cleanup inventory route requires an inventory service.');
  }

  router.get('/pending-cleanup/inventory', requireAdmin, asyncHandler(async (_req, res) => {
    const inventory = await policyRuntimePendingQuestionCleanupInventoryService.run();
    res.set('Cache-Control', 'no-store');
    res.json(inventory);
  }));
}
