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
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
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

  router.get('/', asyncHandler(async (_req, res) => {
    const mediaServer = await getActiveMediaServerConfig({ db });
    return sendData(res, maskMediaServerConfig(mediaServer, maskTokenValue));
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const mediaServer = await saveActiveMediaServerConfig({
      db,
      mediaServerConfig: req.body,
      isMaskedTokenValue,
    });

    return sendData(res, maskMediaServerConfig(mediaServer, maskTokenValue));
  }));

  router.post('/test', asyncHandler(async (req, res) => {
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
    return sendData(res, result);
  }));

  router.post('/sync', asyncHandler(async (_req, res) => {
    const libraries = await syncMediaServerLibraries({
      db,
      getMediaServerServiceByType,
      mediaSyncService,
      logger,
    });

    return sendSuccess(res, {
      libraries,
      message: `Found ${libraries.length} libraries. Content sync started in background.`,
    });
  }));

  router.post('/ingest', asyncHandler(async (_req, res) => {
    const result = await queueService.refillQueue();

    return sendSuccess(res, {
      queued: result?.queued || 0,
      message: `Ingestion triggered. Added ${result?.queued || 0} items to queue.`,
    });
  }));

  return router;
}
