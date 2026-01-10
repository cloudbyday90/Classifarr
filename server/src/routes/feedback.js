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
const feedbackAnalysis = require('../services/feedbackAnalysis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FeedbackRoutes');
const router = express.Router();

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Record a feedback event
 *     description: Records user classification decision for policy learning
 */
router.post('/', async (req, res) => {
    try {
        const feedbackData = req.body;

        // Validate required fields
        if (!feedbackData.tmdb_id || !feedbackData.selected_library_id) {
            return res.status(400).json({
                error: 'Missing required fields: tmdb_id and selected_library_id are required'
            });
        }

        const feedbackId = await feedbackAnalysis.recordFeedback(feedbackData);

        res.status(201).json({
            success: true,
            feedbackId,
            message: 'Feedback recorded successfully'
        });

    } catch (error) {
        logger.error('Error recording feedback', { error: error.message });
        res.status(500).json({
            error: 'Failed to record feedback',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/policies/{id}/suggestions:
 *   get:
 *     summary: Get pending suggestions for a policy
 */
router.get('/policies/:id/suggestions', async (req, res) => {
    try {
        const policyId = parseInt(req.params.id);

        if (isNaN(policyId)) {
            return res.status(400).json({ error: 'Invalid policy ID' });
        }

        const suggestions = await feedbackAnalysis.getPendingSuggestions(policyId);

        res.json({
            policyId,
            count: suggestions.length,
            suggestions
        });

    } catch (error) {
        logger.error('Error getting suggestions', { error: error.message });
        res.status(500).json({
            error: 'Failed to get suggestions',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/policies/{id}/analyze:
 *   post:
 *     summary: Trigger policy analysis
 *     description: Analyzes feedback and generates tuning suggestions
 */
router.post('/policies/:id/analyze', async (req, res) => {
    try {
        const policyId = parseInt(req.params.id);
        const options = {
            days: parseInt(req.body.days) || 30,
            minFeedback: parseInt(req.body.minFeedback) || 5
        };

        if (isNaN(policyId)) {
            return res.status(400).json({ error: 'Invalid policy ID' });
        }

        const analysis = await feedbackAnalysis.analyzePolicy(policyId, options);

        res.json({
            success: true,
            ...analysis
        });

    } catch (error) {
        logger.error('Error analyzing policy', { error: error.message });
        res.status(500).json({
            error: 'Failed to analyze policy',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/policies/{id}/stats:
 *   get:
 *     summary: Get learning statistics for a policy
 */
router.get('/policies/:id/stats', async (req, res) => {
    try {
        const policyId = parseInt(req.params.id);

        if (isNaN(policyId)) {
            return res.status(400).json({ error: 'Invalid policy ID' });
        }

        // Get stats directly from database
        const db = require('../config/database');
        const result = await db.query(`
            SELECT 
                pls.*,
                lp.name as policy_name,
                lp.library_id,
                l.name as library_name
            FROM policy_learning_stats pls
            JOIN library_policies lp ON pls.policy_id = lp.id
            JOIN libraries l ON lp.library_id = l.id
            WHERE pls.policy_id = $1
        `, [policyId]);

        if (result.rows.length === 0) {
            // No stats yet, return empty stats
            return res.json({
                policyId,
                message: 'No learning statistics available yet',
                stats: null
            });
        }

        res.json({
            policyId,
            stats: result.rows[0]
        });

    } catch (error) {
        logger.error('Error getting learning stats', { error: error.message });
        res.status(500).json({
            error: 'Failed to get learning stats',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/suggestions/{id}/apply:
 *   post:
 *     summary: Apply a tuning suggestion
 */
router.post('/suggestions/:id/apply', async (req, res) => {
    try {
        const suggestionId = parseInt(req.params.id);
        const userId = req.body.userId || 1; // Default to admin user if not provided

        if (isNaN(suggestionId)) {
            return res.status(400).json({ error: 'Invalid suggestion ID' });
        }

        const result = await feedbackAnalysis.applySuggestion(suggestionId, userId);

        res.json({
            success: true,
            ...result,
            message: 'Suggestion applied successfully'
        });

    } catch (error) {
        logger.error('Error applying suggestion', { error: error.message });
        res.status(500).json({
            error: 'Failed to apply suggestion',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/suggestions/{id}/reject:
 *   post:
 *     summary: Reject a tuning suggestion
 */
router.post('/suggestions/:id/reject', async (req, res) => {
    try {
        const suggestionId = parseInt(req.params.id);
        const userId = req.body.userId || 1;
        const reason = req.body.reason || 'Not applicable';

        if (isNaN(suggestionId)) {
            return res.status(400).json({ error: 'Invalid suggestion ID' });
        }

        const result = await feedbackAnalysis.rejectSuggestion(suggestionId, userId, reason);

        res.json({
            success: true,
            ...result,
            message: 'Suggestion rejected'
        });

    } catch (error) {
        logger.error('Error rejecting suggestion', { error: error.message });
        res.status(500).json({
            error: 'Failed to reject suggestion',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/feedback/analyze-all:
 *   post:
 *     summary: Run analysis for all active policies
 */
router.post('/analyze-all', async (req, res) => {
    try {
        const results = await feedbackAnalysis.runFullAnalysis();

        res.json({
            success: true,
            ...results
        });

    } catch (error) {
        logger.error('Error running full analysis', { error: error.message });
        res.status(500).json({
            error: 'Failed to run full analysis',
            details: error.message
        });
    }
});

module.exports = router;
