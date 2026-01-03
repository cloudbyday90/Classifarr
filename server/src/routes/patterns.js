/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const db = require('../config/database');
const patternMiningService = require('../services/patternMiningService');
const patternReinforcementService = require('../services/patternReinforcementService');
const embeddingRouter = require('../services/embeddingRouter');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PatternsRoute');
const router = express.Router();

/**
 * @swagger
 * /api/patterns:
 *   get:
 *     summary: List discovered patterns with filtering
 *     description: Get list of patterns with optional filters
 */
router.get('/', async (req, res) => {
    try {
        const {
            status,
            type,
            min_confidence,
            search,
            page = 1,
            per_page = 30
        } = req.query;

        let query = `
            SELECT 
                dp.*,
                l.name as library_name,
                COUNT(pml.id) as match_count
            FROM discovered_patterns dp
            LEFT JOIN libraries l ON l.id = dp.library_id
            LEFT JOIN pattern_match_log pml ON pml.pattern_id = dp.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        // Apply filters
        if (status) {
            query += ` AND dp.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (type) {
            query += ` AND dp.pattern_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (min_confidence) {
            query += ` AND dp.confidence >= $${paramIndex}`;
            params.push(parseFloat(min_confidence));
            paramIndex++;
        }

        if (search) {
            query += ` AND dp.pattern_value ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += `
            GROUP BY dp.id, l.name
            ORDER BY dp.confidence DESC, dp.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(parseInt(per_page));
        params.push((parseInt(page) - 1) * parseInt(per_page));

        const result = await db.query(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(DISTINCT dp.id) FROM discovered_patterns dp WHERE 1=1`;
        const countParams = [];
        let countParamIndex = 1;

        if (status) {
            countQuery += ` AND dp.status = $${countParamIndex}`;
            countParams.push(status);
            countParamIndex++;
        }
        if (type) {
            countQuery += ` AND dp.pattern_type = $${countParamIndex}`;
            countParams.push(type);
            countParamIndex++;
        }
        if (min_confidence) {
            countQuery += ` AND dp.confidence >= $${countParamIndex}`;
            countParams.push(parseFloat(min_confidence));
            countParamIndex++;
        }
        if (search) {
            countQuery += ` AND dp.pattern_value ILIKE $${countParamIndex}`;
            countParams.push(`%${search}%`);
            countParamIndex++;
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            patterns: result.rows,
            pagination: {
                page: parseInt(page),
                per_page: parseInt(per_page),
                total,
                total_pages: Math.ceil(total / parseInt(per_page))
            }
        });
    } catch (error) {
        logger.error('Error listing patterns', { error: error.message });
        res.status(500).json({ error: 'Failed to list patterns' });
    }
});

/**
 * @swagger
 * /api/patterns/summary:
 *   get:
 *     summary: Get pattern statistics summary
 */
router.get('/summary', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'discovered') as discovered,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                COUNT(*) FILTER (WHERE status = 'decayed') as decayed,
                AVG(confidence) as avg_confidence,
                SUM(sample_size) as total_samples
            FROM discovered_patterns
        `);

        // Get conflict count
        const conflictResult = await db.query(`
            SELECT COUNT(*) as conflicts
            FROM (
                SELECT pattern_type, pattern_value
                FROM discovered_patterns
                WHERE status IN ('discovered', 'approved')
                GROUP BY pattern_type, pattern_value
                HAVING COUNT(*) > 1
            ) conflicts
        `);

        // Get pattern type breakdown
        const typeResult = await db.query(`
            SELECT 
                pattern_type,
                COUNT(*) as count,
                AVG(confidence) as avg_confidence
            FROM discovered_patterns
            WHERE status IN ('discovered', 'approved')
            GROUP BY pattern_type
            ORDER BY count DESC
        `);

        const summary = {
            ...result.rows[0],
            conflicts: parseInt(conflictResult.rows[0].conflicts),
            by_type: typeResult.rows
        };

        res.json(summary);
    } catch (error) {
        logger.error('Error getting pattern summary', { error: error.message });
        res.status(500).json({ error: 'Failed to get pattern summary' });
    }
});

/**
 * @swagger
 * /api/patterns/:id:
 *   get:
 *     summary: Get pattern details with match history
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get pattern details
        const patternResult = await db.query(`
            SELECT 
                dp.*,
                l.name as library_name
            FROM discovered_patterns dp
            LEFT JOIN libraries l ON l.id = dp.library_id
            WHERE dp.id = $1
        `, [id]);

        if (patternResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        const pattern = patternResult.rows[0];

        // Get accuracy statistics
        const accuracy = await patternReinforcementService.getPatternAccuracy(id);

        // Get recent match history
        const historyResult = await db.query(`
            SELECT 
                pml.*,
                ch.title,
                ch.library_name,
                ch.created_at as classification_date
            FROM pattern_match_log pml
            JOIN classification_history ch ON ch.id = pml.classification_id
            WHERE pml.pattern_id = $1
            ORDER BY pml.created_at DESC
            LIMIT 20
        `, [id]);

        res.json({
            pattern,
            accuracy,
            recent_matches: historyResult.rows
        });
    } catch (error) {
        logger.error('Error getting pattern details', { error: error.message, id: req.params.id });
        res.status(500).json({ error: 'Failed to get pattern details' });
    }
});

/**
 * @swagger
 * /api/patterns/:id/approve:
 *   put:
 *     summary: Approve a pattern
 */
router.put('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_by = 'user' } = req.body;

        const result = await db.query(`
            UPDATE discovered_patterns
            SET 
                status = 'approved',
                approved_by = $1,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [approved_by, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        logger.info('Pattern approved', { id, approved_by });
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error approving pattern', { error: error.message, id: req.params.id });
        res.status(500).json({ error: 'Failed to approve pattern' });
    }
});

/**
 * @swagger
 * /api/patterns/:id/reject:
 *   put:
 *     summary: Reject a pattern
 */
router.put('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejected_by = 'user', rejection_reason } = req.body;

        const result = await db.query(`
            UPDATE discovered_patterns
            SET 
                status = 'rejected',
                rejected_by = $1,
                rejected_at = NOW(),
                rejection_reason = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [rejected_by, rejection_reason, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        logger.info('Pattern rejected', { id, rejected_by, reason: rejection_reason });
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error rejecting pattern', { error: error.message, id: req.params.id });
        res.status(500).json({ error: 'Failed to reject pattern' });
    }
});

/**
 * @swagger
 * /api/patterns/:id:
 *   delete:
 *     summary: Delete a pattern
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            DELETE FROM discovered_patterns
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        logger.info('Pattern deleted', { id });
        res.json({ success: true, pattern: result.rows[0] });
    } catch (error) {
        logger.error('Error deleting pattern', { error: error.message, id: req.params.id });
        res.status(500).json({ error: 'Failed to delete pattern' });
    }
});

/**
 * @swagger
 * /api/patterns/resolve-conflicts:
 *   post:
 *     summary: Resolve all pattern conflicts
 *     description: Auto-resolves conflicts by keeping highest confidence pattern
 */
router.post('/resolve-conflicts', async (req, res) => {
    try {
        const result = await patternReinforcementService.resolveConflicts();
        logger.info('Conflicts resolved', result);
        res.json(result);
    } catch (error) {
        logger.error('Error resolving conflicts', { error: error.message });
        res.status(500).json({ error: 'Failed to resolve conflicts' });
    }
});

/**
 * @swagger
 * /api/patterns/discover:
 *   post:
 *     summary: Manually trigger pattern discovery
 */
router.post('/discover', async (req, res) => {
    try {
        const result = await patternMiningService.discoverPatterns();
        logger.info('Pattern discovery triggered', result);
        res.json(result);
    } catch (error) {
        logger.error('Error discovering patterns', { error: error.message });
        res.status(500).json({ error: 'Failed to discover patterns' });
    }
});

/**
 * @swagger
 * /api/patterns/config:
 *   get:
 *     summary: Get pattern configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = await embeddingRouter.getConfig();
        res.json({
            pattern_mining_enabled: config?.pattern_mining_enabled || false,
            pattern_rule_priority: config?.pattern_rule_priority || 'rules_first',
            pattern_ai_skip_threshold: config?.pattern_ai_skip_threshold || 90,
            pattern_notification_dismissed: config?.pattern_notification_dismissed || false
        });
    } catch (error) {
        logger.error('Error getting pattern config', { error: error.message });
        res.status(500).json({ error: 'Failed to get pattern config' });
    }
});

/**
 * @swagger
 * /api/patterns/config:
 *   put:
 *     summary: Update pattern configuration
 */
router.put('/config', async (req, res) => {
    try {
        const {
            pattern_mining_enabled,
            pattern_rule_priority,
            pattern_ai_skip_threshold,
            pattern_notification_dismissed
        } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (typeof pattern_mining_enabled === 'boolean') {
            updates.push(`pattern_mining_enabled = $${paramIndex}`);
            params.push(pattern_mining_enabled);
            paramIndex++;
        }

        if (pattern_rule_priority) {
            updates.push(`pattern_rule_priority = $${paramIndex}`);
            params.push(pattern_rule_priority);
            paramIndex++;
        }

        if (typeof pattern_ai_skip_threshold === 'number') {
            updates.push(`pattern_ai_skip_threshold = $${paramIndex}`);
            params.push(pattern_ai_skip_threshold);
            paramIndex++;
        }

        if (typeof pattern_notification_dismissed === 'boolean') {
            updates.push(`pattern_notification_dismissed = $${paramIndex}`);
            params.push(pattern_notification_dismissed);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        const query = `
            UPDATE ai_provider_config
            SET ${updates.join(', ')}
            WHERE id = 1
            RETURNING 
                pattern_mining_enabled,
                pattern_rule_priority,
                pattern_ai_skip_threshold,
                pattern_notification_dismissed
        `;

        const result = await db.query(query, params);

        logger.info('Pattern config updated', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating pattern config', { error: error.message });
        res.status(500).json({ error: 'Failed to update pattern config' });
    }
});

module.exports = router;
