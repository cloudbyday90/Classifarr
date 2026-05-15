/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

export function createMappingsRouter({ express, libraryMappingService }) {
  const router = express.Router();

  router.get('/:mediaServerId', asyncHandler(async (req, res) => {
    const { mediaServerId } = req.params;
    const mappings = await libraryMappingService.getMappings(Number.parseInt(mediaServerId, 10));
    return sendData(res, mappings);
  }));

  router.get('/:mediaServerId/unmapped', asyncHandler(async (req, res) => {
    const { mediaServerId } = req.params;
    const unmapped = await libraryMappingService.getUnmappedLibraries(Number.parseInt(mediaServerId, 10));
    return sendData(res, unmapped);
  }));

  router.get('/:mediaServerId/arr-instances', asyncHandler(async (req, res) => {
    const { mediaServerId } = req.params;
    const instances = await libraryMappingService.getAvailableArrInstances(Number.parseInt(mediaServerId, 10));
    return sendData(res, instances);
  }));

  router.get('/root-folders/:arrType/:arrConfigId', asyncHandler(async (req, res) => {
    const { arrType, arrConfigId } = req.params;
    const folders = await libraryMappingService.getArrRootFolders(arrType, Number.parseInt(arrConfigId, 10));
    return sendData(res, folders);
  }));

  router.get('/library/:libraryId', asyncHandler(async (req, res) => {
    const { libraryId } = req.params;
    const mapping = await libraryMappingService.getLibraryMapping(Number.parseInt(libraryId, 10));
    return sendData(res, mapping || { mapped: false });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const mapping = await libraryMappingService.saveMapping(req.body);
    return sendData(res, mapping);
  }));

  router.delete('/library/:libraryId', asyncHandler(async (req, res) => {
    const { libraryId } = req.params;
    const success = await libraryMappingService.deleteMapping(Number.parseInt(libraryId, 10));
    return sendData(res, { success });
  }));

  router.post('/:mediaServerId/auto-detect', asyncHandler(async (req, res) => {
    const { mediaServerId } = req.params;
    const result = await libraryMappingService.autoDetectMappings(Number.parseInt(mediaServerId, 10));
    return sendData(res, result);
  }));

  router.post('/link-arr', asyncHandler(async (req, res) => {
    const { arrType, arrConfigId, mediaServerId } = req.body;
    await libraryMappingService.linkArrToMediaServer(arrType, arrConfigId, mediaServerId);
    return sendSuccess(res);
  }));

  return router;
}
