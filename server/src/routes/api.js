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
const webhookRouter = require('./webhook');
const mediaServerRouter = require('./mediaServer');
const librariesRouter = require('./libraries');
const classificationRouter = require('./classification');
const ruleBuilderRouter = require('./ruleBuilder');
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
router.use('/webhook', webhookRouter);
router.use('/media-server', mediaServerRouter);
router.use('/libraries', librariesRouter);
router.use('/classification', classificationRouter);
router.use('/rule-builder', ruleBuilderRouter);
router.use('/settings', settingsRouter);
router.use('/logs', logsRouter);
router.use('/media-sync', mediaSyncRouter);
router.use('/clarifications', clarificationRouter);
router.use('/plex', plexOAuthRouter);
router.use('/jellyfin', jellyfinAuthRouter);
router.use('/emby', embyAuthRouter);
router.use('/queue', queueRouter);
router.use('/requests', requestsRouter);
router.use('/stats', statsRouter);
router.use('/scheduler', schedulerRouter);
router.use('/backup', backupRouter);
router.use('/mappings', mappingsRouter);
router.use('/reclassification', reclassificationRouter);
router.use('/settings/path-mappings', pathMappingsRouter);
router.use('/confidence', confidenceRouter);
router.use('/rag', ragRouter);
router.use('/patterns', patternsRouter);
router.use('/feedback', feedbackRouter);
router.use('/prompts', promptsRouter);
router.use('/policies', policiesRouter);
router.use('/presets', presetsRouter);
router.use('/suggestions', suggestionsRouter);
router.use('/migration', migrationRouter);
router.use('/rating-normalization', ratingNormalizationRouter);
router.use('/sync', syncRouter);
router.use('/keys', apiKeysRouter); // API key management
router.use('/notifications', notificationsRouter);

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
      ruleBuilder: '/api/rule-builder',
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
