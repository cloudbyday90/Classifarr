/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  getActiveMediaServerConfig,
  maskMediaServerConfig,
  resolveMediaServerApiKey,
  resolveMediaServerService,
  saveActiveMediaServerConfig,
} from './helpers/mediaServerConfigHelpers.mjs';
import { syncMediaServerLibraries } from '../services/mediaServerLibrarySync.mjs';

export function createMediaServerRouter({
  express,
  db,
  mediaSyncService,
  queueService,
  getMediaServerServiceByType,
  maskTokenValue,
  isMaskedTokenValue,
  logger,
}) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const mediaServer = await getActiveMediaServerConfig({ db });
      res.json(maskMediaServerConfig(mediaServer, maskTokenValue));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const mediaServer = await saveActiveMediaServerConfig({
        db,
        mediaServerConfig: req.body,
        isMaskedTokenValue,
      });

      res.json(maskMediaServerConfig(mediaServer, maskTokenValue));
    } catch (error) {
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message });
      }
      logger.error('Failed to save media server config:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      const { type, url, api_key } = req.body;

      const testApiKey = await resolveMediaServerApiKey({
        db,
        apiKey: api_key,
        isMaskedTokenValue,
      });
      const service = resolveMediaServerService({
        type,
        getMediaServerServiceByType,
      });

      const result = await service.testConnection(url, testApiKey);
      res.json(result);
    } catch (error) {
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sync', async (_req, res) => {
    try {
      const libraries = await syncMediaServerLibraries({
        db,
        getMediaServerServiceByType,
        mediaSyncService,
        logger,
      });

      res.json({
        success: true,
        libraries,
        message: `Found ${libraries.length} libraries. Content sync started in background.`,
      });
    } catch (error) {
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/ingest', async (_req, res) => {
    try {
      const result = await queueService.refillQueue();

      res.json({
        success: true,
        queued: result?.queued || 0,
        message: `Ingestion triggered. Added ${result?.queued || 0} items to queue.`,
      });
    } catch (error) {
      logger.error('Failed to trigger ingestion:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
