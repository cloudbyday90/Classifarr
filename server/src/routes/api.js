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

const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const webhookRouter = require('./webhook');
const mediaServerRouter = require('./mediaServer');
const librariesRouter = require('./libraries');
const classificationRouter = require('./classification');
const settingsRouter = require('./settings');
const logsRouter = require('./logs');
const mediaSyncRouter = require('./mediaSync');
const clarificationRouter = require('./clarification');
const plexOAuthRouter = require('./plexOAuth');
const jellyfinAuthRouter = require('./jellyfinAuth');
const embyAuthRouter = require('./embyAuth');
const queueRouter = require('./queue');
const requestsRouter = require('./requests');
const statsRouter = require('./stats');
const schedulerRouter = require('./scheduler');
const backupRouter = require('./backup');
const mappingsRouter = require('./mappings');
const reclassificationRouter = require('./reclassification');
const pathMappingsRouter = require('./pathMappings');
const confidenceRouter = require('./confidence');
const ragRouter = require('./rag');
const patternsRouter = require('./patterns');
const feedbackRouter = require('./feedback');
const promptsRouter = require('./prompts');
const policiesRouter = require('./policies');
const presetsRouter = require('./presets');
const suggestionsRouter = require('./suggestions');
const migrationRouter = require('./migration');
const ratingNormalizationRouter = require('./ratingNormalization');
const syncRouter = require('./sync');
const apiKeysRouter = require('./apiKeys');
const notificationsRouter = require('./notifications');

const router = express.Router();

// Mount all route modules
// Public routes (no auth)
router.use('/webhook', webhookRouter);
router.use('/plex', plexOAuthRouter);
router.use('/jellyfin', jellyfinAuthRouter);
router.use('/emby', embyAuthRouter);

// Routes with internal auth
router.use('/libraries', librariesRouter);
router.use('/logs', logsRouter);
router.use('/media-sync', mediaSyncRouter);
router.use('/queue', queueRouter);
router.use('/stats', statsRouter);
router.use('/backup', backupRouter);

// Tier 1: Admin-Only Routes
router.use('/media-server', authenticateToken, requireAdmin, mediaServerRouter);
router.use('/classification', authenticateToken, requireAdmin, classificationRouter);
router.use('/settings', authenticateToken, requireAdmin, settingsRouter);
router.use('/reclassification', authenticateToken, requireAdmin, reclassificationRouter);
router.use('/policies', authenticateToken, requireAdmin, policiesRouter);
router.use('/mappings', authenticateToken, requireAdmin, mappingsRouter);
router.use('/confidence', authenticateToken, requireAdmin, confidenceRouter);
router.use('/rag', authenticateToken, requireAdmin, ragRouter);
router.use('/patterns', authenticateToken, requireAdmin, patternsRouter);
router.use('/scheduler', authenticateToken, requireAdmin, schedulerRouter);
router.use('/settings/path-mappings', authenticateToken, requireAdmin, pathMappingsRouter);

// Tier 2: Authenticated User Routes
router.use('/clarifications', authenticateToken, clarificationRouter);
router.use('/requests', authenticateToken, requestsRouter);
router.use('/feedback', authenticateToken, feedbackRouter);
router.use('/prompts', authenticateToken, promptsRouter);
router.use('/presets', authenticateToken, presetsRouter);
router.use('/suggestions', authenticateToken, suggestionsRouter);
router.use('/migration', authenticateToken, migrationRouter);
router.use('/rating-normalization', authenticateToken, ratingNormalizationRouter);
router.use('/sync', authenticateToken, syncRouter);
router.use('/keys', authenticateToken, requireAdmin, apiKeysRouter);
router.use('/notifications', authenticateToken, notificationsRouter);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Classifarr API',
    version: '1.0.0',
    description: 'AI-powered media classification for the *arr ecosystem',
    endpoints: {
      webhook: '/api/webhook',
      mediaServer: '/api/media-server',
      libraries: '/api/libraries',
      classification: '/api/classification',
      settings: '/api/settings',
      logs: '/api/logs',
      mediaSync: '/api/media-sync',
      clarifications: '/api/clarifications',
      plex: '/api/plex',
      feedback: '/api/feedback',
      prompts: '/api/prompts',
      policies: '/api/policies',
      presets: '/api/presets',
      suggestions: '/api/suggestions',
      migration: '/api/migration',
      notifications: '/api/notifications',
      docs: '/api/docs',
    },
  });
});

module.exports = router;
