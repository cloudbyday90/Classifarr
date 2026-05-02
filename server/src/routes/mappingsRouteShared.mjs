/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createMappingsRouter({ express, libraryMappingService }) {
  const router = express.Router();

  router.get('/:mediaServerId', async (req, res) => {
    try {
      const { mediaServerId } = req.params;
      const mappings = await libraryMappingService.getMappings(Number.parseInt(mediaServerId, 10));
      return res.json(mappings);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:mediaServerId/unmapped', async (req, res) => {
    try {
      const { mediaServerId } = req.params;
      const unmapped = await libraryMappingService.getUnmappedLibraries(Number.parseInt(mediaServerId, 10));
      return res.json(unmapped);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:mediaServerId/arr-instances', async (req, res) => {
    try {
      const { mediaServerId } = req.params;
      const instances = await libraryMappingService.getAvailableArrInstances(Number.parseInt(mediaServerId, 10));
      return res.json(instances);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/root-folders/:arrType/:arrConfigId', async (req, res) => {
    try {
      const { arrType, arrConfigId } = req.params;
      const folders = await libraryMappingService.getArrRootFolders(arrType, Number.parseInt(arrConfigId, 10));
      return res.json(folders);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/library/:libraryId', async (req, res) => {
    try {
      const { libraryId } = req.params;
      const mapping = await libraryMappingService.getLibraryMapping(Number.parseInt(libraryId, 10));
      return res.json(mapping || { mapped: false });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const mapping = await libraryMappingService.saveMapping(req.body);
      return res.json(mapping);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/library/:libraryId', async (req, res) => {
    try {
      const { libraryId } = req.params;
      const success = await libraryMappingService.deleteMapping(Number.parseInt(libraryId, 10));
      return res.json({ success });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:mediaServerId/auto-detect', async (req, res) => {
    try {
      const { mediaServerId } = req.params;
      const result = await libraryMappingService.autoDetectMappings(Number.parseInt(mediaServerId, 10));
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/link-arr', async (req, res) => {
    try {
      const { arrType, arrConfigId, mediaServerId } = req.body;
      await libraryMappingService.linkArrToMediaServer(arrType, arrConfigId, mediaServerId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}