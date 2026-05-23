/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function registerConfidenceRoutes(router, { authenticateToken, requireAdmin, confidenceSettingsHandlers }) {
  router.get('/confidence', authenticateToken, confidenceSettingsHandlers.getSettings);
  router.put('/confidence', authenticateToken, requireAdmin, confidenceSettingsHandlers.updateSettings);
  router.get('/confidence/history', authenticateToken, requireAdmin, confidenceSettingsHandlers.getHistory);
  router.post('/confidence/revert/:auditId', authenticateToken, requireAdmin, confidenceSettingsHandlers.revertSetting);
  router.post('/confidence/export', authenticateToken, requireAdmin, confidenceSettingsHandlers.exportSettings);
  router.post('/confidence/import', authenticateToken, requireAdmin, confidenceSettingsHandlers.importSettings);
}
