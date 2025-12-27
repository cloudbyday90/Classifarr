/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Path Mappings API Routes
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PathMappings');

/**
 * GET /api/settings/path-mappings
 * Get all path mappings
 */
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
      SELECT * FROM path_mappings 
      ORDER BY created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to get path mappings', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/path-mappings
 * Create a new path mapping
 */
router.post('/', async (req, res) => {
    try {
        const { arr_path, local_path } = req.body;

        if (!arr_path || !local_path) {
            return res.status(400).json({ error: 'Both arr_path and local_path are required' });
        }

        // Normalize paths (remove trailing slashes)
        const normalizedArrPath = arr_path.replace(/\/+$/, '');
        const normalizedLocalPath = local_path.replace(/\/+$/, '');

        const result = await db.query(`
      INSERT INTO path_mappings (arr_path, local_path, is_active)
      VALUES ($1, $2, true)
      RETURNING *
    `, [normalizedArrPath, normalizedLocalPath]);

        logger.info('Created path mapping', { arr_path: normalizedArrPath, local_path: normalizedLocalPath });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to create path mapping', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/settings/path-mappings/:id
 * Update a path mapping
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { arr_path, local_path, is_active } = req.body;

        const normalizedArrPath = arr_path?.replace(/\/+$/, '');
        const normalizedLocalPath = local_path?.replace(/\/+$/, '');

        const result = await db.query(`
      UPDATE path_mappings 
      SET arr_path = COALESCE($2, arr_path),
          local_path = COALESCE($3, local_path),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, normalizedArrPath, normalizedLocalPath, is_active]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Path mapping not found' });
        }

        logger.info('Updated path mapping', { id });
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to update path mapping', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/settings/path-mappings/:id
 * Delete a path mapping
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query('DELETE FROM path_mappings WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Path mapping not found' });
        }

        logger.info('Deleted path mapping', { id });
        res.json({ message: 'Path mapping deleted', deleted: result.rows[0] });
    } catch (error) {
        logger.error('Failed to delete path mapping', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/path-mappings/:id/verify
 * Verify a path mapping is accessible
 */
router.post('/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;

        // Get the mapping
        const mappingResult = await db.query('SELECT * FROM path_mappings WHERE id = $1', [id]);
        if (mappingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Path mapping not found' });
        }

        const mapping = mappingResult.rows[0];

        // Check if local path exists and is accessible
        try {
            const stats = await fs.stat(mapping.local_path);
            const isDirectory = stats.isDirectory();

            if (!isDirectory) {
                return res.json({
                    success: false,
                    verified: false,
                    error: 'Path exists but is not a directory'
                });
            }

            // Update verification status
            await db.query(`
        UPDATE path_mappings 
        SET verified = true, last_verified_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id]);

            logger.info('Path mapping verified successfully', { id, local_path: mapping.local_path });
            res.json({
                success: true,
                verified: true,
                message: `Path "${mapping.local_path}" is accessible`,
                isDirectory: true
            });

        } catch (fsError) {
            // Path doesn't exist or isn't accessible
            await db.query(`
        UPDATE path_mappings 
        SET verified = false, last_verified_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id]);

            logger.warn('Path mapping verification failed', { id, local_path: mapping.local_path, error: fsError.message });
            res.json({
                success: false,
                verified: false,
                error: `Path is not accessible: ${fsError.message}`
            });
        }
    } catch (error) {
        logger.error('Failed to verify path mapping', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/path-mappings/verify-all
 * Verify all active path mappings
 */
router.post('/verify-all', async (req, res) => {
    try {
        const mappings = await db.query('SELECT * FROM path_mappings WHERE is_active = true');
        const results = [];

        for (const mapping of mappings.rows) {
            try {
                const stats = await fs.stat(mapping.local_path);
                const isAccessible = stats.isDirectory();

                await db.query(`
          UPDATE path_mappings 
          SET verified = $2, last_verified_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [mapping.id, isAccessible]);

                results.push({
                    id: mapping.id,
                    arr_path: mapping.arr_path,
                    local_path: mapping.local_path,
                    verified: isAccessible
                });
            } catch (fsError) {
                await db.query(`
          UPDATE path_mappings 
          SET verified = false, last_verified_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [mapping.id]);

                results.push({
                    id: mapping.id,
                    arr_path: mapping.arr_path,
                    local_path: mapping.local_path,
                    verified: false,
                    error: fsError.message
                });
            }
        }

        const allVerified = results.every(r => r.verified);
        logger.info('Verified all path mappings', { total: results.length, allVerified });

        res.json({
            success: allVerified,
            results,
            summary: {
                total: results.length,
                verified: results.filter(r => r.verified).length,
                failed: results.filter(r => !r.verified).length
            }
        });
    } catch (error) {
        logger.error('Failed to verify path mappings', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
