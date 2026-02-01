/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PresetsRoute');

// ============================================================================
// CUSTOM PRESETS CRUD
// ============================================================================

/**
 * @swagger
 * /api/presets/custom:
 *   get:
 *     summary: List all custom presets
 */
router.get('/custom', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                cp.*,
                u.username as created_by_username
            FROM custom_presets cp
            LEFT JOIN users u ON cp.created_by = u.id
            ORDER BY cp.name
        `);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list custom presets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/presets/custom/{id}:
 *   get:
 *     summary: Get custom preset by ID
 */
router.get('/custom/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                cp.*,
                u.username as created_by_username
            FROM custom_presets cp
            LEFT JOIN users u ON cp.created_by = u.id
            WHERE cp.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Custom preset not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to get custom preset', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/presets/custom:
 *   post:
 *     summary: Create a new custom preset
 */
router.post('/custom', async (req, res) => {
    try {
        const {
            name,
            description,
            icon = '⚙️',
            category = 'custom',
            signals = {},
            created_by = null
        } = req.body;

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Preset name is required' });
        }

        if (name.length > 100) {
            return res.status(400).json({ error: 'Preset name must be 100 characters or less' });
        }

        // Validate signals structure
        if (typeof signals !== 'object') {
            return res.status(400).json({ error: 'Signals must be a valid object' });
        }

        const result = await db.query(`
            INSERT INTO custom_presets (name, description, icon, category, signals, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name.trim(), description, icon, category, JSON.stringify(signals), created_by]);

        logger.info('Custom preset created', {
            id: result.rows[0].id,
            name: result.rows[0].name
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to create custom preset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/presets/custom/{id}:
 *   put:
 *     summary: Update a custom preset
 */
router.put('/custom/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            icon,
            category,
            signals
        } = req.body;

        // Check if preset exists
        const existing = await db.query(
            'SELECT * FROM custom_presets WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Custom preset not found' });
        }

        // Validation
        if (name !== undefined && name.trim().length === 0) {
            return res.status(400).json({ error: 'Preset name cannot be empty' });
        }

        if (name !== undefined && name.length > 100) {
            return res.status(400).json({ error: 'Preset name must be 100 characters or less' });
        }

        if (signals !== undefined && typeof signals !== 'object') {
            return res.status(400).json({ error: 'Signals must be a valid object' });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (icon !== undefined) {
            updates.push(`icon = $${paramIndex++}`);
            values.push(icon);
        }
        if (category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            values.push(category);
        }
        if (signals !== undefined) {
            updates.push(`signals = $${paramIndex++}`);
            values.push(JSON.stringify(signals));
        }

        // Always update timestamp
        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
            // Only timestamp update, nothing else to change
            return res.json(existing.rows[0]);
        }

        values.push(id);
        const result = await db.query(`
            UPDATE custom_presets 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, values);

        logger.info('Custom preset updated', { id, name: result.rows[0].name });

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to update custom preset', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/presets/custom/{id}:
 *   delete:
 *     summary: Delete a custom preset
 */
router.delete('/custom/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if preset exists
        const existing = await db.query(
            'SELECT * FROM custom_presets WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Custom preset not found' });
        }

        // Check if preset is used in any policies (via policy_presets table)
        // Note: Custom presets will need a different FK relationship
        // For now, just delete

        await db.query('DELETE FROM custom_presets WHERE id = $1', [id]);

        logger.info('Custom preset deleted', { id, name: existing.rows[0].name });

        res.json({
            message: 'Custom preset deleted successfully',
            preset: existing.rows[0]
        });
    } catch (error) {
        logger.error('Failed to delete custom preset', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Unified endpoint: Get all presets (built-in + custom)
// ============================================================================

/**
 * @swagger
 * /api/presets/all:
 *   get:
 *     summary: List all presets (built-in and custom)
 */
router.get('/all', async (req, res) => {
    try {
        const { category, search, include_custom = 'true' } = req.query;

        let query = `
            SELECT 
                id, 
                key, 
                name, 
                description, 
                icon, 
                category, 
                signals,
                is_system,
                display_order,
                'builtin' as source
            FROM content_presets
            WHERE 1=1
        `;
        let params = [];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (search) {
            params.push(`%${search.toLowerCase()}%`);
            query += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`;
        }

        // Union with custom presets if requested
        if (include_custom === 'true') {
            query += `
                UNION ALL
                SELECT 
                    id + 100000 as id,  -- Offset to avoid ID collision
                    'custom_' || id as key,
                    name,
                    description,
                    icon,
                    category,
                    signals,
                    false as is_system,
                    0 as display_order,
                    'custom' as source
                FROM custom_presets
                WHERE 1=1
            `;

            if (category && category !== 'custom') {
                query += ` AND category = '${category}'`;
            }

            if (search) {
                query += ` AND (LOWER(name) LIKE '%${search.toLowerCase()}%' OR LOWER(description) LIKE '%${search.toLowerCase()}%')`;
            }
        }

        query += ` ORDER BY source DESC, display_order, name`;

        const result = await db.query(query, params);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list all presets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
