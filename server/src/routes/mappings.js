/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const express = require('express');
const libraryMappingService = require('../services/libraryMappingService');

const router = express.Router();

/**
 * @swagger
 * /api/mappings/{mediaServerId}:
 *   get:
 *     summary: Get all library mappings for a media server
 */
router.get('/:mediaServerId', async (req, res) => {
    try {
        const { mediaServerId } = req.params;
        const mappings = await libraryMappingService.getMappings(parseInt(mediaServerId));
        res.json(mappings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/{mediaServerId}/unmapped:
 *   get:
 *     summary: Get unmapped libraries for a media server
 */
router.get('/:mediaServerId/unmapped', async (req, res) => {
    try {
        const { mediaServerId } = req.params;
        const unmapped = await libraryMappingService.getUnmappedLibraries(parseInt(mediaServerId));
        res.json(unmapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/{mediaServerId}/arr-instances:
 *   get:
 *     summary: Get available *arr instances for a media server
 */
router.get('/:mediaServerId/arr-instances', async (req, res) => {
    try {
        const { mediaServerId } = req.params;
        const instances = await libraryMappingService.getAvailableArrInstances(parseInt(mediaServerId));
        res.json(instances);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/root-folders/{arrType}/{arrConfigId}:
 *   get:
 *     summary: Get root folders from a *arr instance
 */
router.get('/root-folders/:arrType/:arrConfigId', async (req, res) => {
    try {
        const { arrType, arrConfigId } = req.params;
        const folders = await libraryMappingService.getArrRootFolders(arrType, parseInt(arrConfigId));
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/library/{libraryId}:
 *   get:
 *     summary: Get mapping for a specific library
 */
router.get('/library/:libraryId', async (req, res) => {
    try {
        const { libraryId } = req.params;
        const mapping = await libraryMappingService.getLibraryMapping(parseInt(libraryId));
        res.json(mapping || { mapped: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings:
 *   post:
 *     summary: Create or update a library mapping
 */
router.post('/', async (req, res) => {
    try {
        const mapping = await libraryMappingService.saveMapping(req.body);
        res.json(mapping);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/library/{libraryId}:
 *   delete:
 *     summary: Delete a library mapping
 */
router.delete('/library/:libraryId', async (req, res) => {
    try {
        const { libraryId } = req.params;
        const success = await libraryMappingService.deleteMapping(parseInt(libraryId));
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/{mediaServerId}/auto-detect:
 *   post:
 *     summary: Auto-detect and apply library mappings
 */
router.post('/:mediaServerId/auto-detect', async (req, res) => {
    try {
        const { mediaServerId } = req.params;
        const result = await libraryMappingService.autoDetectMappings(parseInt(mediaServerId));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/mappings/link-arr:
 *   post:
 *     summary: Link a *arr instance to a media server
 */
router.post('/link-arr', async (req, res) => {
    try {
        const { arrType, arrConfigId, mediaServerId } = req.body;
        await libraryMappingService.linkArrToMediaServer(arrType, arrConfigId, mediaServerId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
