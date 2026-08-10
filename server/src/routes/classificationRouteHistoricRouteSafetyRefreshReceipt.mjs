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

export function registerHistoricRouteSafetyRefreshReceiptRoute(router, {
  policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService,
} = {}) {
  if (typeof policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService?.run !== 'function') {
    throw new TypeError('Historic route-safety refresh receipt route requires a reconciliation service.');
  }

  router.get('/pending/route-safety-refresh/receipts/:receiptId', requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService.run({
        receiptId: req.params.receiptId,
      });

      res.set('Cache-Control', 'no-store');
      res.json(result);
    }));
}
