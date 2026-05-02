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
import databaseModule from '../config/database.mjs';
import mediaSyncDefault from '../services/mediaSync.mjs';
import queueService from '../services/queueService.mjs';
import { isMaskedToken, maskToken } from '../utils/tokenMasking.mjs';
import loggerModule from '../utils/logger.mjs';
import { getMediaServerService } from '../services/mediaServers/index.mjs';

const db = databaseModule;
const { createLogger } = loggerModule;

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
    const client = await db.pool.connect();
    try {
      const { type, name, url, api_key } = req.body;

      await client.query('BEGIN');

      const existingResult = await client.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
      const existingApiKey = existingResult.rows[0]?.api_key;
      const finalApiKey = (api_key && !isMaskedTokenValue(api_key)) ? api_key : existingApiKey;

      if (!finalApiKey) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'API key is required' });
      }

      const activeServerResult = await client.query('SELECT id FROM media_server WHERE is_active = true LIMIT 1');

      let result;
      if (activeServerResult.rows.length > 0) {
        result = await client.query(
          `UPDATE media_server 
           SET type = $1, name = $2, url = $3, api_key = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
          [type, name, url, finalApiKey, activeServerResult.rows[0].id]
        );
      } else {
        result = await client.query(
          `INSERT INTO media_server (type, name, url, api_key, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
          [type, name, url, finalApiKey]
        );
      }

      await client.query('COMMIT');

      if (result.rows[0].api_key) {
        result.rows[0].api_key = maskTokenValue(result.rows[0].api_key);
      }

      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      loggerInstance.error('Failed to save media server config:', { error: error.message });
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
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
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const serverResult = await client.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

      if (serverResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No active media server configured' });
      }

      const server = serverResult.rows[0];
      let service;
      try {
        service = getMediaServerServiceByType(server.type);
      } catch (_error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid media server type' });
      }

      const libraries = await service.getLibraries(server.url, server.api_key);
      const existingLibsResult = await client.query(
        'SELECT id, external_id, name, media_type, arr_type FROM libraries WHERE media_server_id = $1',
        [server.id]
      );
      const existingLibsMap = new Map(existingLibsResult.rows.map((library) => [library.external_id, library]));

      const insertedLibraries = [];
      const librariesToInsert = [];
      const librariesToUpdate = [];

      for (const library of libraries) {
        const existing = existingLibsMap.get(library.external_id);
        let arrType = null;
        if (library.media_type === 'movie') {
          arrType = 'radarr';
        } else if (library.media_type === 'tv') {
          arrType = 'sonarr';
        }

        if (existing) {
          if (existing.name !== library.name || existing.media_type !== library.media_type || existing.arr_type !== arrType) {
            librariesToUpdate.push({
              id: existing.id,
              name: library.name,
              media_type: library.media_type,
              arr_type: arrType,
            });
          }

          insertedLibraries.push({
            ...existing,
            name: library.name,
            media_type: library.media_type,
            arr_type: arrType,
          });

        } else {
          librariesToInsert.push({
            ...library,
            arrType,
          });
        }
      }

      const librariesToDelete = existingLibsResult.rows.filter((library) => !libraries.find((remote) => remote.external_id === library.external_id));
      const idsToDelete = librariesToDelete.map((library) => library.id);

      if (idsToDelete.length > 0) {
        loggerInstance.info(`Deleting ${idsToDelete.length} libraries that are no longer on the media server`);
        await client.query('DELETE FROM media_server_sync_status WHERE library_id = ANY($1)', [idsToDelete]);
        await client.query(
          `DELETE FROM enrichment_retry_queue 
           WHERE media_item_id IN (SELECT id FROM media_server_items WHERE library_id = ANY($1))`,
          [idsToDelete]
        );
        await client.query('DELETE FROM libraries WHERE id = ANY($1)', [idsToDelete]);
      }

      for (const update of librariesToUpdate) {
        await client.query(
          `UPDATE libraries 
           SET name = $1, media_type = $2, arr_type = $3, updated_at = NOW()
           WHERE id = $4`,
          [update.name, update.media_type, update.arr_type, update.id]
        );
      }

      for (const library of librariesToInsert) {
        const result = await client.query(
          `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [server.id, library.external_id, library.name, library.media_type, library.arrType]
        );
        const newLibrary = result.rows[0];

        await client.query(
          `INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
           VALUES ($1, $2, $3, true, 5, 85, 60)
           ON CONFLICT (library_id) DO NOTHING`,
          [newLibrary.id, `${newLibrary.name} Policy`, `Auto-generated policy for ${newLibrary.name}`]
        );

        insertedLibraries.push(newLibrary);
      }

      await client.query('UPDATE media_server SET last_sync = NOW() WHERE id = $1', [server.id]);
      await client.query('COMMIT');

      for (const library of insertedLibraries) {
        mediaSyncService.syncLibrary(library.id, { incremental: false, batchSize: 100 })
          .then((result) => {
            loggerInstance.info(`Auto-sync completed for library ${library.name}: ${result.itemsImported || 0} items`);
          })
          .catch((error) => {
            loggerInstance.error(`Auto-sync failed for library ${library.name}:`, { error: error.message });
          });
      }

      res.json({
        success: true,
        libraries: insertedLibraries,
        message: `Found ${insertedLibraries.length} libraries. Content sync started in background.`,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
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

const router = createMediaServerRouter();

export default router;
