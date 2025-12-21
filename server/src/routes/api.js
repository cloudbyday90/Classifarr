/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
      docs: '/api/docs',
    },
  });
});

module.exports = router;
