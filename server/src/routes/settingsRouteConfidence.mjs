/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerConfidenceRoutes(router, { authenticateToken, requireAdmin, confidenceSettingsHandlers }) {
  router.get('/confidence', authenticateToken, asyncHandler(confidenceSettingsHandlers.getSettings));
  router.put('/confidence', authenticateToken, requireAdmin, asyncHandler(confidenceSettingsHandlers.updateSettings));
  router.get('/confidence/history', authenticateToken, requireAdmin, asyncHandler(confidenceSettingsHandlers.getHistory));
  router.post('/confidence/revert/:auditId', authenticateToken, requireAdmin, asyncHandler(confidenceSettingsHandlers.revertSetting));
  router.post('/confidence/export', authenticateToken, requireAdmin, asyncHandler(confidenceSettingsHandlers.exportSettings));
  router.post('/confidence/import', authenticateToken, requireAdmin, asyncHandler(confidenceSettingsHandlers.importSettings));
}
