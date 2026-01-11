/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const logger = createLogger('PoliciesRoute');

/**
 * @swagger
 * /api/policies/presets/all:
 *   get:
 *     summary: List all available presets
 */
router.get('/presets/all', async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = `
            SELECT *
            FROM content_presets
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (category) {
            query += ` AND category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` ORDER BY category, display_order, name`;

        const result = await db.query(query, params);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list presets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/presets/categories:
 *   get:
 *     summary: List preset categories with counts
 */
router.get('/presets/categories', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                category,
                COUNT(*) as count
            FROM content_presets
            WHERE category IS NOT NULL
            GROUP BY category
            ORDER BY category
        `);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list preset categories', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies:
 *   get:
 *     summary: List all policies with preset counts
 */
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                lp.*,
                l.name as library_name,
                l.media_type as library_media_type,
                (SELECT COUNT(*) FROM policy_presets WHERE policy_id = lp.id) as preset_count
            FROM library_policies lp
            JOIN libraries l ON lp.library_id = l.id
            ORDER BY l.name, lp.priority DESC, lp.sort_order ASC
        `);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list policies', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}:
 *   get:
 *     summary: Get policy with presets
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get policy details
        const policyResult = await db.query(`
            SELECT 
                lp.*,
                l.name as library_name,
                l.media_type as library_media_type
            FROM library_policies lp
            JOIN libraries l ON lp.library_id = l.id
            WHERE lp.id = $1
        `, [id]);

        if (policyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const policy = policyResult.rows[0];

        // Get attached presets
        const presetsResult = await db.query(`
            SELECT 
                cp.*,
                pp.weight,
                pp.custom_signals
            FROM policy_presets pp
            JOIN content_presets cp ON pp.preset_id = cp.id
            WHERE pp.policy_id = $1
            ORDER BY pp.sort_order, cp.display_order, cp.name
        `, [id]);

        policy.presets = presetsResult.rows;

        res.json(policy);
    } catch (error) {
        logger.error('Failed to get policy', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies:
 *   post:
 *     summary: Create new policy
 */
router.post('/', async (req, res) => {
    try {
        const {
            library_id,
            name,
            description,
            enabled = true,
            priority = 5,
            sort_order = 0,
            auto_classify_threshold = 85,
            prompt_threshold = 60,
            require_ai_validation = true,
            trust_patterns = true,
            trust_rag = true,
            trust_history = true,
            preset_weight = 0.40,
            pattern_weight = 0.30,
            rag_weight = 0.20,
            history_weight = 0.10,
            combination_mode = 'best_match',
            presets = []
        } = req.body;

        if (!library_id || !name) {
            return res.status(400).json({ error: 'library_id and name are required' });
        }

        // Validate thresholds
        if (auto_classify_threshold < 0 || auto_classify_threshold > 100) {
            return res.status(400).json({ error: 'auto_classify_threshold must be between 0 and 100' });
        }
        if (prompt_threshold < 0 || prompt_threshold > 100) {
            return res.status(400).json({ error: 'prompt_threshold must be between 0 and 100' });
        }

        // Validate weights
        if (preset_weight < 0 || preset_weight > 1) {
            return res.status(400).json({ error: 'preset_weight must be between 0 and 1' });
        }
        if (pattern_weight < 0 || pattern_weight > 1) {
            return res.status(400).json({ error: 'pattern_weight must be between 0 and 1' });
        }
        if (rag_weight < 0 || rag_weight > 1) {
            return res.status(400).json({ error: 'rag_weight must be between 0 and 1' });
        }
        if (history_weight < 0 || history_weight > 1) {
            return res.status(400).json({ error: 'history_weight must be between 0 and 1' });
        }

        // Validate weights sum to 1.0 (with tolerance for floating-point precision)
        const totalWeight = preset_weight + pattern_weight + rag_weight + history_weight;
        if (Math.abs(totalWeight - 1.0) > 0.001) {
            return res.status(400).json({
                error: `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`
            });
        }

        // Begin transaction
        await db.query('BEGIN');

        try {
            // Create policy
            const policyResult = await db.query(`
                INSERT INTO library_policies (
                    library_id, name, description, enabled, priority, sort_order,
                    auto_classify_threshold, prompt_threshold, require_ai_validation,
                    trust_patterns, trust_rag, trust_history,
                    preset_weight, pattern_weight, rag_weight, history_weight,
                    combination_mode
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
            `, [
                library_id, name, description, enabled, priority, sort_order,
                auto_classify_threshold, prompt_threshold, require_ai_validation,
                trust_patterns, trust_rag, trust_history,
                preset_weight, pattern_weight, rag_weight, history_weight,
                combination_mode
            ]);

            const policy = policyResult.rows[0];

            // Attach presets
            if (presets && presets.length > 0) {
                for (const preset of presets) {
                    await db.query(`
                        INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
                        VALUES ($1, $2, $3, $4)
                    `, [policy.id, preset.preset_id, preset.weight || 1.0, preset.customSignals || null]);
                }
            }

            await db.query('COMMIT');

            // Fetch complete policy with presets
            const completePolicy = await db.query(`
                SELECT 
                    lp.*,
                    l.name as library_name,
                    l.media_type as library_media_type
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.id = $1
            `, [policy.id]);

            const presetsResult = await db.query(`
                SELECT 
                    cp.*,
                    pp.weight,
                    pp.custom_signals
                FROM policy_presets pp
                JOIN content_presets cp ON pp.preset_id = cp.id
                WHERE pp.policy_id = $1
            `, [policy.id]);

            const result = completePolicy.rows[0];
            result.presets = presetsResult.rows;

            res.status(201).json(result);
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        logger.error('Failed to create policy', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}:
 *   put:
 *     summary: Update policy
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            enabled,
            priority,
            sort_order,
            auto_classify_threshold,
            prompt_threshold,
            require_ai_validation,
            trust_patterns,
            trust_rag,
            trust_history,
            preset_weight,
            pattern_weight,
            rag_weight,
            history_weight,
            combination_mode,
            presets
        } = req.body;

        // Begin transaction
        await db.query('BEGIN');

        try {
            // Validate thresholds if provided
            if (auto_classify_threshold !== undefined && (auto_classify_threshold < 0 || auto_classify_threshold > 100)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'auto_classify_threshold must be between 0 and 100' });
            }
            if (prompt_threshold !== undefined && (prompt_threshold < 0 || prompt_threshold > 100)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'prompt_threshold must be between 0 and 100' });
            }

            // Validate weights if provided
            if (preset_weight !== undefined && (preset_weight < 0 || preset_weight > 1)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'preset_weight must be between 0 and 1' });
            }
            if (pattern_weight !== undefined && (pattern_weight < 0 || pattern_weight > 1)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'pattern_weight must be between 0 and 1' });
            }
            if (rag_weight !== undefined && (rag_weight < 0 || rag_weight > 1)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'rag_weight must be between 0 and 1' });
            }
            if (history_weight !== undefined && (history_weight < 0 || history_weight > 1)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'history_weight must be between 0 and 1' });
            }

            // If all weights are provided, validate they sum to 1.0
            if (preset_weight !== undefined && pattern_weight !== undefined &&
                rag_weight !== undefined && history_weight !== undefined) {
                const totalWeight = preset_weight + pattern_weight + rag_weight + history_weight;
                if (Math.abs(totalWeight - 1.0) > 0.001) {
                    await db.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`
                    });
                }
            }

            // Update policy
            await db.query(`
                UPDATE library_policies SET
                    name = COALESCE($1, name),
                    description = COALESCE($2, description),
                    enabled = COALESCE($3, enabled),
                    priority = COALESCE($4, priority),
                    sort_order = COALESCE($5, sort_order),
                    auto_classify_threshold = COALESCE($6, auto_classify_threshold),
                    prompt_threshold = COALESCE($7, prompt_threshold),
                    require_ai_validation = COALESCE($8, require_ai_validation),
                    trust_patterns = COALESCE($9, trust_patterns),
                    trust_rag = COALESCE($10, trust_rag),
                    trust_history = COALESCE($11, trust_history),
                    preset_weight = COALESCE($12, preset_weight),
                    pattern_weight = COALESCE($13, pattern_weight),
                    rag_weight = COALESCE($14, rag_weight),
                    history_weight = COALESCE($15, history_weight),
                    combination_mode = COALESCE($16, combination_mode),
                    updated_at = NOW()
                WHERE id = $17
            `, [
                name, description, enabled, priority, sort_order,
                auto_classify_threshold, prompt_threshold, require_ai_validation,
                trust_patterns, trust_rag, trust_history,
                preset_weight, pattern_weight, rag_weight, history_weight,
                combination_mode, id
            ]);

            // Update presets if provided
            if (presets !== undefined) {
                // Remove existing presets
                await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [id]);

                // Add new presets
                if (presets.length > 0) {
                    for (const preset of presets) {
                        await db.query(`
                            INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
                            VALUES ($1, $2, $3, $4)
                        `, [id, preset.preset_id, preset.weight || 1.0, preset.customSignals || null]);
                    }
                }
            }

            await db.query('COMMIT');

            // Fetch updated policy
            const policyResult = await db.query(`
                SELECT 
                    lp.*,
                    l.name as library_name,
                    l.media_type as library_media_type
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.id = $1
            `, [id]);

            if (policyResult.rows.length === 0) {
                return res.status(404).json({ error: 'Policy not found' });
            }

            const presetsResult = await db.query(`
                SELECT 
                    cp.*,
                    pp.weight,
                    pp.custom_signals
                FROM policy_presets pp
                JOIN content_presets cp ON pp.preset_id = cp.id
                WHERE pp.policy_id = $1
            `, [id]);

            const policy = policyResult.rows[0];
            policy.presets = presetsResult.rows;

            res.json(policy);
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        logger.error('Failed to update policy', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}:
 *   delete:
 *     summary: Delete policy
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query('DELETE FROM library_policies WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        res.json({ message: 'Policy deleted successfully', policy: result.rows[0] });
    } catch (error) {
        logger.error('Failed to delete policy', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}/presets:
 *   get:
 *     summary: Get policy's presets
 */
router.get('/:id/presets', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                cp.*,
                pp.weight,
                pp.custom_signals
            FROM policy_presets pp
            JOIN content_presets cp ON pp.preset_id = cp.id
            WHERE pp.policy_id = $1
            ORDER BY pp.sort_order, cp.display_order, cp.name
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to get policy presets', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}/presets:
 *   post:
 *     summary: Attach preset to policy
 */
router.post('/:id/presets', async (req, res) => {
    try {
        const { id } = req.params;
        const { preset_id, weight = 1.0 } = req.body;

        if (!preset_id) {
            return res.status(400).json({ error: 'preset_id is required' });
        }

        // Check if preset already attached
        const existing = await db.query(
            'SELECT * FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
            [id, preset_id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Preset already attached to this policy' });
        }

        const customSignals = req.body.customSignals || null;
        const result = await db.query(`
            INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [id, preset_id, weight, customSignals]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to attach preset', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}/presets/{presetId}:
 *   delete:
 *     summary: Remove preset from policy
 */
router.delete('/:id/presets/:presetId', async (req, res) => {
    try {
        const { id, presetId } = req.params;

        const result = await db.query(
            'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2 RETURNING *',
            [id, presetId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not attached to this policy' });
        }

        res.json({ message: 'Preset removed successfully' });
    } catch (error) {
        logger.error('Failed to remove preset', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
