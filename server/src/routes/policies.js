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
            SELECT
                cp.*,
                COALESCE(ppu.usage_count, 0)::int AS usage_count
            FROM content_presets cp
            LEFT JOIN (
                SELECT preset_id, COUNT(*)::int AS usage_count
                FROM policy_presets
                GROUP BY preset_id
            ) ppu ON ppu.preset_id = cp.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (category) {
            query += ` AND cp.category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        if (search) {
            query += ` AND (cp.name ILIKE $${paramCount} OR cp.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` ORDER BY cp.category, cp.display_order, cp.name`;

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
 * /api/policies/presets/{presetId}/usage:
 *   get:
 *     summary: Get usage count for a preset (how many policies use it)
 *     parameters:
 *       - in: path
 *         name: presetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Preset ID
 */
router.get('/presets/:presetId/usage', async (req, res) => {
    try {
        const { presetId } = req.params;
        const presetIdNum = Number.parseInt(presetId, 10);

        if (!Number.isInteger(presetIdNum) || presetIdNum < 1) {
            return res.status(400).json({ error: 'Invalid presetId: must be a positive integer' });
        }

        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM policy_presets
            WHERE preset_id = $1
        `, [presetIdNum]);

        res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (error) {
        logger.error('Failed to get preset usage count', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/presets/suggest/{libraryId}:
 *   get:
 *     summary: Get suggested presets for a library based on name matching
 *     parameters:
 *       - in: path
 *         name: libraryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Library ID to get suggestions for
 */
router.get('/presets/suggest/:libraryId', async (req, res) => {
    try {
        const { libraryId } = req.params;

        // Get library info
        const libraryResult = await db.query(
            'SELECT id, name, media_type FROM libraries WHERE id = $1',
            [libraryId]
        );

        if (libraryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Library not found' });
        }

        const library = libraryResult.rows[0];
        const libraryName = library.name.toLowerCase();

        // Tokenize library name into words for matching
        const tokens = libraryName
            .replace(/[^a-z0-9\s]/g, ' ')  // Replace special chars with space
            .split(/\s+/)                   // Split by whitespace
            .filter(t => t.length > 2);     // Only tokens 3+ chars

        logger.debug('Library name tokens for matching', { libraryId, libraryName, tokens });

        // Get all system presets with their signals
        const presetsResult = await db.query(`
            SELECT 
                id, key, name, description, icon, category, signals,
                is_system, display_order
            FROM content_presets
            WHERE is_system = true
            ORDER BY display_order, name
        `);

        // Calculate match score for each preset
        const suggestions = presetsResult.rows.map(preset => {
            let score = 0;
            const matchReasons = [];

            const presetKey = preset.key.toLowerCase();
            const presetName = preset.name.toLowerCase();
            const presetDesc = (preset.description || '').toLowerCase();

            // 1. Exact key match (highest score)
            if (tokens.some(t => presetKey.includes(t) || t.includes(presetKey))) {
                score += 50;
                matchReasons.push('key_match');
            }

            // 2. Name contains token (high score)
            const nameMatchCount = tokens.filter(t => presetName.includes(t)).length;
            if (nameMatchCount > 0) {
                score += nameMatchCount * 30;
                matchReasons.push('name_match');
            }

            // 3. Library name contains preset name/key
            if (libraryName.includes(presetKey) || libraryName.includes(presetName.replace(/[^a-z0-9]/g, ''))) {
                score += 40;
                matchReasons.push('library_contains_preset');
            }

            // 4. Genre signal matching
            const signals = preset.signals || {};
            const genreSignals = signals.genres || {};
            const requireGenres = genreSignals.require_any || [];
            const preferGenres = genreSignals.prefer || [];

            const allGenres = [...requireGenres, ...preferGenres].map(g => g.toLowerCase());
            const genreMatchCount = tokens.filter(t =>
                allGenres.some(g => g.includes(t) || t.includes(g))
            ).length;
            if (genreMatchCount > 0) {
                score += genreMatchCount * 20;
                matchReasons.push('genre_match');
            }

            // 5. Description contains token (lower score)
            const descMatchCount = tokens.filter(t => presetDesc.includes(t)).length;
            if (descMatchCount > 0) {
                score += descMatchCount * 10;
                matchReasons.push('description_match');
            }

            // 6. Category keyword bonus
            const categoryMatch = tokens.some(t => (preset.category || '').toLowerCase().includes(t));
            if (categoryMatch) {
                score += 15;
                matchReasons.push('category_match');
            }

            return {
                ...preset,
                match_score: score,
                match_reasons: matchReasons
            };
        });

        // Filter to only suggestions with score > 0, sort by score desc, top 8
        const topSuggestions = suggestions
            .filter(s => s.match_score > 0)
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 8);

        logger.info('Preset suggestions generated', {
            libraryId,
            libraryName: library.name,
            suggestionCount: topSuggestions.length,
            topMatch: topSuggestions[0]?.name
        });

        res.json({
            library_id: library.id,
            library_name: library.name,
            suggestions: topSuggestions
        });
    } catch (error) {
        logger.error('Failed to get preset suggestions', { error: error.message, libraryId: req.params.libraryId });
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
                (SELECT COUNT(*)::int FROM policy_presets WHERE policy_id = lp.id) as preset_count
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

        const policy = await db.withTransaction(async (client) => {
            // Create policy
            const policyResult = await client.query(`
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

            const p = policyResult.rows[0];

            // Attach presets
            if (presets && presets.length > 0) {
                for (const preset of presets) {
                    await client.query(`
                        INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
                        VALUES ($1, $2, $3, $4)
                    `, [p.id, preset.preset_id, preset.weight || 1.0, preset.customSignals || null]);
                }
            }

            return p;
        });

        // Fetch complete policy with presets (reads committed data outside transaction)
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

        // Validate before opening a transaction — avoids consuming a pool slot for input errors
        if (auto_classify_threshold !== undefined && (auto_classify_threshold < 0 || auto_classify_threshold > 100)) {
            return res.status(400).json({ error: 'auto_classify_threshold must be between 0 and 100' });
        }
        if (prompt_threshold !== undefined && (prompt_threshold < 0 || prompt_threshold > 100)) {
            return res.status(400).json({ error: 'prompt_threshold must be between 0 and 100' });
        }

        // Validate weights if provided
        if (preset_weight !== undefined && (preset_weight < 0 || preset_weight > 1)) {
            return res.status(400).json({ error: 'preset_weight must be between 0 and 1' });
        }
        if (pattern_weight !== undefined && (pattern_weight < 0 || pattern_weight > 1)) {
            return res.status(400).json({ error: 'pattern_weight must be between 0 and 1' });
        }
        if (rag_weight !== undefined && (rag_weight < 0 || rag_weight > 1)) {
            return res.status(400).json({ error: 'rag_weight must be between 0 and 1' });
        }
        if (history_weight !== undefined && (history_weight < 0 || history_weight > 1)) {
            return res.status(400).json({ error: 'history_weight must be between 0 and 1' });
        }

        // If all weights are provided, validate they sum to 1.0
        if (preset_weight !== undefined && pattern_weight !== undefined &&
            rag_weight !== undefined && history_weight !== undefined) {
            const totalWeight = preset_weight + pattern_weight + rag_weight + history_weight;
            if (Math.abs(totalWeight - 1.0) > 0.001) {
                return res.status(400).json({
                    error: `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`
                });
            }
        }

        await db.withTransaction(async (client) => {
            // Update policy
            await client.query(`
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
                await client.query('DELETE FROM policy_presets WHERE policy_id = $1', [id]);

                // Add new presets
                if (presets.length > 0) {
                    for (const preset of presets) {
                        await client.query(`
                            INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
                            VALUES ($1, $2, $3, $4)
                        `, [id, preset.preset_id, preset.weight || 1.0, preset.customSignals || null]);
                    }
                }
            }
        });

        // Fetch updated policy (reads committed data outside transaction)
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
        logger.error('Failed to update policy', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/policies/{id}:
 *   delete:
 *     summary: Reset policy (delete and recreate blank)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get the policy details before deleting
        const policyResult = await db.query(
            `SELECT lp.*, l.name as library_name 
             FROM library_policies lp 
             JOIN libraries l ON lp.library_id = l.id 
             WHERE lp.id = $1`,
            [id]
        );

        if (policyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const oldPolicy = policyResult.rows[0];
        const libraryId = oldPolicy.library_id;
        const libraryName = oldPolicy.library_name;

        // Delete the old policy (cascades to policy_presets)
        await db.query('DELETE FROM library_policies WHERE id = $1', [id]);

        // Auto-create a fresh blank policy for the library
        const newPolicyResult = await db.query(
            `INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
             VALUES ($1, $2, $3, true, 5, 85, 60)
             RETURNING *`,
            [libraryId, `${libraryName} Policy`, `Reset policy for ${libraryName}`]
        );

        logger.info('Policy reset (delete + recreate)', {
            oldPolicyId: id,
            newPolicyId: newPolicyResult.rows[0].id,
            libraryId,
            libraryName
        });

        res.json({
            message: 'Policy reset successfully',
            oldPolicy: oldPolicy,
            newPolicy: newPolicyResult.rows[0]
        });
    } catch (error) {
        logger.error('Failed to reset policy', { error: error.message, id: req.params.id });
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
