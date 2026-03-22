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
const { listPresets } = require('../utils/presetCatalog');

const logger = createLogger('PresetsRoute');

function isValidSignalsPayload(signals) {
    return Boolean(signals) && typeof signals === 'object' && !Array.isArray(signals);
}

function normalizeCustomPresetRow(row) {
    if (!row) {
        return row;
    }

    return {
        ...row,
        created_by: row.created_by ?? row.user_id ?? null,
        created_by_username: row.created_by_username ?? null,
        source: 'custom'
    };
}

function slugifyPresetName(name) {
    const slug = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return slug || 'preset';
}

function buildCustomPresetKey(id, name) {
    return `custom_${id}_${slugifyPresetName(name)}`.slice(0, 50);
}

async function getCustomPresetById(id) {
    const result = await db.query(`
        SELECT 
            cp.*,
            cp.user_id as created_by,
            u.username as created_by_username
        FROM content_presets cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.id = $1
          AND cp.is_system = false
    `, [id]);

    return result.rows[0] ? normalizeCustomPresetRow(result.rows[0]) : null;
}

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
                cp.user_id as created_by,
                u.username as created_by_username
            FROM content_presets cp
            LEFT JOIN users u ON cp.user_id = u.id
            WHERE cp.is_system = false
            ORDER BY cp.name
        `);

        res.json(result.rows.map(normalizeCustomPresetRow));
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
        const preset = await getCustomPresetById(id);

        if (!preset) {
            return res.status(404).json({ error: 'Custom preset not found' });
        }

        res.json(preset);
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
        if (!isValidSignalsPayload(signals)) {
            return res.status(400).json({ error: 'Signals must be a valid object' });
        }

        const keySeed = await db.query(`SELECT nextval('content_presets_id_seq') AS id`);
        const presetId = keySeed.rows[0].id;
        const presetKey = buildCustomPresetKey(presetId, name.trim());

        await db.query(`
            INSERT INTO content_presets (
                id, key, name, description, icon, category, signals,
                is_system, user_id, is_public, display_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, false, 0)
        `, [presetId, presetKey, name.trim(), description, icon, category, JSON.stringify(signals), created_by]);

        const createdPreset = await getCustomPresetById(presetId);

        logger.info('Custom preset created', {
            id: createdPreset.id,
            name: createdPreset.name
        });

        res.status(201).json(createdPreset);
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
            'SELECT * FROM content_presets WHERE id = $1 AND is_system = false',
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

        if (signals !== undefined && !isValidSignalsPayload(signals)) {
            return res.status(400).json({ error: 'Signals must be a valid object' });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;
        const effectiveName = name !== undefined ? name.trim() : existing.rows[0].name;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(effectiveName);
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
        if (name !== undefined) {
            updates.push(`key = $${paramIndex++}`);
            values.push(buildCustomPresetKey(id, effectiveName));
        }

        // Always update timestamp
        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
            // Only timestamp update, nothing else to change
            return res.json(normalizeCustomPresetRow(existing.rows[0]));
        }

        values.push(id);
        await db.query(`
            UPDATE content_presets 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex} AND is_system = false
        `, values);

        const updatedPreset = await getCustomPresetById(id);

        logger.info('Custom preset updated', { id, name: updatedPreset.name });

        res.json(updatedPreset);
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
            'SELECT * FROM content_presets WHERE id = $1 AND is_system = false',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Custom preset not found' });
        }

        await db.query('DELETE FROM content_presets WHERE id = $1 AND is_system = false', [id]);

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
        const { category, search, include_custom } = req.query;
        const presets = await listPresets({
            category,
            search,
            includeCustom: include_custom !== 'false',
            orderBy: 'unified'
        });

        res.json(presets);
    } catch (error) {
        logger.error('Failed to list all presets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
