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
import * as databaseModule from '../config/database.mjs';
import { mediaSyncService as mediaSyncDefault } from '../services/mediaSync.mjs';
import { queueService } from '../services/queueService.mjs';
import { isMaskedToken, maskToken } from '../utils/tokenMasking.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getMediaServerService } from '../services/mediaServers/index.mjs';
import { syncMediaServerLibraries } from './helpers/mediaServerHelpers.mjs';

const logger = createLogger('mediaServer');

export function createMediaServerRouter({
  expressInstance = express,
  db = databaseModule,
  mediaSyncService = mediaSyncDefault,
  queueServiceInstance = queueService,
  getMediaServerServiceByType = getMediaServerService,
  maskTokenValue = maskToken,
  isMaskedTokenValue = isMaskedToken,
  loggerInstance = logger,
} = {}) {
  const router = expressInstance.Router();

  router.get('/', async (_req, res) => {
    try {
      const result = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');
      if (result.rows[0] && result.rows[0].api_key) {
        result.rows[0].api_key = maskTokenValue(result.rows[0].api_key);
      }
      res.json(result.rows[0] || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { type, name, url, api_key } = req.body;

      const result = await db.withTransaction(async (client) => {
        const existingResult = await client.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
        const existingApiKey = existingResult.rows[0]?.api_key;
        const finalApiKey = (api_key && !isMaskedTokenValue(api_key)) ? api_key : existingApiKey;

        if (!finalApiKey) {
          const err = new Error('API key is required');
          err.httpStatus = 400;
          throw err;
        }

        const activeServerResult = await client.query('SELECT id FROM media_server WHERE is_active = true LIMIT 1');

        if (activeServerResult.rows.length > 0) {
          return client.query(
            `UPDATE media_server 
             SET type = $1, name = $2, url = $3, api_key = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [type, name, url, finalApiKey, activeServerResult.rows[0].id]
          );
        }

        return client.query(
          `INSERT INTO media_server (type, name, url, api_key, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
          [type, name, url, finalApiKey]
        );
      });

      if (result.rows[0].api_key) {
        result.rows[0].api_key = maskTokenValue(result.rows[0].api_key);
      }

      res.json(result.rows[0]);
    } catch (error) {
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message });
      }
      loggerInstance.error('Failed to save media server config:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      const { type, url, api_key } = req.body;

      let testApiKey = api_key;
      if (isMaskedTokenValue(api_key)) {
        const existingResult = await db.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
        testApiKey = existingResult.rows[0]?.api_key;
        if (!testApiKey) {
          return res.status(400).json({ error: 'No saved API key found. Please enter the API key manually.' });
        }
      }

      let service;
      try {
        service = getMediaServerServiceByType(type);
      } catch (_error) {
        return res.status(400).json({ error: 'Invalid media server type' });
      }

      const result = await service.testConnection(url, testApiKey);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sync', async (_req, res) => {
    try {
      const libraries = await syncMediaServerLibraries({
        db,
        getMediaServerServiceByType,
        mediaSyncService,
        loggerInstance,
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
      const result = await queueServiceInstance.refillQueue();

      res.json({
        success: true,
        queued: result?.queued || 0,
        message: `Ingestion triggered. Added ${result?.queued || 0} items to queue.`,
      });
    } catch (error) {
      loggerInstance.error('Failed to trigger ingestion:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export const router = createMediaServerRouter();
