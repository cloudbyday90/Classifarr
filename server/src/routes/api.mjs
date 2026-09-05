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
import { router as webhookRouter } from './webhook.mjs';
import { router as mediaServerRouter } from './mediaServer.mjs';
import { router as librariesRouter } from './libraries.mjs';
import { router as classificationRouter } from './classification.mjs';
import { router as settingsRouter } from './settings.mjs';
import { router as logsRouter } from './logs.mjs';
import { router as mediaSyncRouter } from './mediaSync.mjs';
import { router as mediaIdentityReviewRouter } from './mediaIdentityReview.mjs';
import { router as clarificationRouter } from './clarification.mjs';
import { router as plexOAuthRouter } from './plexOAuth.mjs';
import { router as jellyfinAuthRouter } from './jellyfinAuth.mjs';
import { router as embyAuthRouter } from './embyAuth.mjs';
import { router as queueRouter } from './queue.mjs';
import { router as requestsRouter } from './requests.mjs';
import { router as statsRouter } from './stats.mjs';
import { router as schedulerRouter } from './scheduler.mjs';
import { router as backupRouter } from './backup.mjs';
import { router as mappingsRouter } from './mappings.mjs';
import { router as reclassificationRouter } from './reclassification.mjs';
import { router as pathMappingsRouter } from './pathMappings.mjs';
import { router as confidenceRouter } from './confidence.mjs';
import { router as ragRouter } from './rag.mjs';
import { router as patternsRouter } from './patterns.mjs';
import { router as evidenceRouter } from './evidence.mjs';
import { router as feedbackRouter } from './feedback.mjs';
import { router as promptsRouter } from './prompts.mjs';
import { router as policiesRouter } from './policies.mjs';
import { router as presetsRouter } from './presets.mjs';
import { router as suggestionsRouter } from './suggestions.mjs';
import { router as migrationRouter } from './migration.mjs';
import { router as ratingNormalizationRouter } from './ratingNormalization.mjs';
import { router as syncRouter } from './sync.mjs';
import { router as apiKeysRouter } from './apiKeys.mjs';
import { router as notificationsRouter } from './notifications.mjs';
import { router as classificationProgressRouter } from './classificationProgress.mjs';

export const router = express.Router();

router.use('/webhook', webhookRouter);
router.use('/plex', plexOAuthRouter);
router.use('/jellyfin', jellyfinAuthRouter);
router.use('/emby', embyAuthRouter);

router.use('/libraries', librariesRouter);
router.use('/logs', logsRouter);
router.use('/media-sync', mediaSyncRouter);
router.use('/media-identity-review', mediaIdentityReviewRouter);
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
