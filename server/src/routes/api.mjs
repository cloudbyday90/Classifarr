/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import webhookRouter from './webhook.mjs';
import mediaServerRouter from './mediaServer.mjs';
import librariesRouter from './libraries.mjs';
import classificationRouter from './classification.mjs';
import settingsRouter from './settings.mjs';
import logsRouter from './logs.mjs';
import mediaSyncRouter from './mediaSync.mjs';
import clarificationRouter from './clarification.mjs';
import plexOAuthRouter from './plexOAuth.mjs';
import jellyfinAuthRouter from './jellyfinAuth.mjs';
import embyAuthRouter from './embyAuth.mjs';
import queueRouter from './queue.mjs';
import requestsRouter from './requests.mjs';
import statsRouter from './stats.mjs';
import schedulerRouter from './scheduler.mjs';
import backupRouter from './backup.mjs';
import mappingsRouter from './mappings.mjs';
import reclassificationRouter from './reclassification.mjs';
import pathMappingsRouter from './pathMappings.mjs';
import confidenceRouter from './confidence.mjs';
import ragRouter from './rag.mjs';
import patternsRouter from './patterns.mjs';
import evidenceRouter from './evidence.mjs';
import feedbackRouter from './feedback.mjs';
import promptsRouter from './prompts.mjs';
import policiesRouter from './policies.mjs';
import presetsRouter from './presets.mjs';
import suggestionsRouter from './suggestions.mjs';
import migrationRouter from './migration.mjs';
import ratingNormalizationRouter from './ratingNormalization.mjs';
import syncRouter from './sync.mjs';
import apiKeysRouter from './apiKeys.mjs';
import notificationsRouter from './notifications.mjs';
import classificationProgressRouter from './classificationProgress.mjs';

const router = express.Router();

router.use('/webhook', webhookRouter);
router.use('/plex', plexOAuthRouter);
router.use('/jellyfin', jellyfinAuthRouter);
router.use('/emby', embyAuthRouter);

router.use('/libraries', librariesRouter);
router.use('/logs', logsRouter);
router.use('/media-sync', mediaSyncRouter);
router.use('/queue', queueRouter);
router.use('/stats', statsRouter);

router.use('/media-server', authenticateToken, requireAdmin, mediaServerRouter);
router.use('/classification/progress', authenticateToken, requireAdmin, classificationProgressRouter);
router.use('/classification', authenticateToken, requireAdmin, classificationRouter);
router.use('/settings', authenticateToken, requireAdmin, settingsRouter);
router.use('/reclassification', authenticateToken, requireAdmin, reclassificationRouter);
router.use('/policies', authenticateToken, requireAdmin, policiesRouter);
router.use('/mappings', authenticateToken, requireAdmin, mappingsRouter);
router.use('/confidence', authenticateToken, requireAdmin, confidenceRouter);
router.use('/rag', authenticateToken, requireAdmin, ragRouter);
router.use('/patterns', authenticateToken, requireAdmin, patternsRouter);
router.use('/evidence', authenticateToken, requireAdmin, evidenceRouter);
router.use('/scheduler', authenticateToken, requireAdmin, schedulerRouter);
router.use('/settings/path-mappings', authenticateToken, requireAdmin, pathMappingsRouter);
router.use('/backup', authenticateToken, requireAdmin, backupRouter);

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

router.get('/', (_req, res) => {
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

export default router;
