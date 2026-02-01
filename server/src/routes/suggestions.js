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
const feedbackAnalysis = require('../services/feedbackAnalysis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SuggestionsRoute');

/**
 * @swagger
 * /api/suggestions:
 *   get:
 *     summary: List all tuning suggestions with filters
 */
router.get('/', async (req, res) => {
    try {
        let { status, policyId } = req.query;
        
        // Convert empty strings to null for proper SQL handling
        if (status === '') status = null;
        if (policyId === '') policyId = null;
        
        // Default to 'pending' only if status was not provided at all
        if (status === undefined) status = 'pending';
        
        const result = await db.query(`
            SELECT 
                pts.*,
                lp.name as policy_name,
                l.name as library_name,
                (SELECT COUNT(*) FROM unnest(pts.supporting_feedback_ids) as fid) as evidence_count
            FROM policy_tuning_suggestions pts
            JOIN library_policies lp ON pts.policy_id = lp.id
            JOIN libraries l ON lp.library_id = l.id
            WHERE ($1::text IS NULL OR pts.status = $1)
            AND ($2::int IS NULL OR pts.policy_id = $2)
            ORDER BY pts.confidence DESC, pts.created_at DESC
        `, [status, policyId]);
        
        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to list suggestions', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/suggestions/:id:
 *   get:
 *     summary: Get suggestion details with supporting evidence
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get suggestion with policy details
        const suggestion = await db.query(`
            SELECT pts.*, lp.name as policy_name, l.name as library_name
            FROM policy_tuning_suggestions pts
            JOIN library_policies lp ON pts.policy_id = lp.id
            JOIN libraries l ON lp.library_id = l.id
            WHERE pts.id = $1
        `, [id]);
        
        if (suggestion.rows.length === 0) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        
        // Get supporting feedback evidence
        const feedbackIds = suggestion.rows[0].supporting_feedback_ids || [];
        let feedback = { rows: [] };
        
        if (feedbackIds.length > 0) {
            feedback = await db.query(`
                SELECT 
                    pfl.*,
                    l.name as original_library,
                    l2.name as selected_library
                FROM policy_feedback_log pfl
                LEFT JOIN libraries l ON pfl.top_suggestion_library_id = l.id
                LEFT JOIN libraries l2 ON pfl.selected_library_id = l2.id
                WHERE pfl.id = ANY($1)
                ORDER BY pfl.prompted_at DESC
            `, [feedbackIds]);
        }
        
        res.json({
            ...suggestion.rows[0],
            supporting_feedback: feedback.rows
        });
    } catch (error) {
        logger.error('Failed to get suggestion', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/suggestions/:id/apply:
 *   post:
 *     summary: Apply a suggestion
 */
router.post('/:id/apply', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1;
        
        // Get current accuracy before applying
        const beforeStats = await db.query(`
            SELECT accuracy_rate, auto_accuracy_rate 
            FROM policy_learning_stats 
            WHERE policy_id = (SELECT policy_id FROM policy_tuning_suggestions WHERE id = $1)
        `, [id]);
        
        // Update suggestion with before metrics
        if (beforeStats.rows.length > 0) {
            await db.query(`
                UPDATE policy_tuning_suggestions 
                SET before_accuracy = $2
                WHERE id = $1
            `, [id, beforeStats.rows[0].accuracy_rate]);
        }
        
        // Apply the suggestion using feedbackAnalysis service
        const result = await feedbackAnalysis.applySuggestion(id, userId);
        
        res.json({ success: true, result });
    } catch (error) {
        logger.error('Failed to apply suggestion', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/suggestions/:id/reject:
 *   post:
 *     summary: Reject a suggestion
 */
router.post('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user?.id || 1;
        
        const result = await feedbackAnalysis.rejectSuggestion(id, userId, reason);
        res.json({ success: true, result });
    } catch (error) {
        logger.error('Failed to reject suggestion', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/suggestions/:id/impact:
 *   get:
 *     summary: Get impact metrics after applying suggestion
 */
router.get('/:id/impact', async (req, res) => {
    try {
        const { id } = req.params;
        
        const suggestion = await db.query(`
            SELECT 
                pts.*,
                pls.accuracy_rate as current_accuracy,
                pls.auto_accuracy_rate as current_auto_accuracy
            FROM policy_tuning_suggestions pts
            LEFT JOIN policy_learning_stats pls ON pts.policy_id = pls.policy_id
            WHERE pts.id = $1
        `, [id]);
        
        if (suggestion.rows.length === 0) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        
        const s = suggestion.rows[0];
        
        res.json({
            before_accuracy: s.before_accuracy,
            after_accuracy: s.current_accuracy,
            improvement: s.current_accuracy - (s.before_accuracy || 0),
            applied_at: s.applied_at
        });
    } catch (error) {
        logger.error('Failed to get impact metrics', { error: error.message, id: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/suggestions/summary:
 *   get:
 *     summary: Get summary statistics for suggestions
 */
router.get('/policy/:policyId/summary', async (req, res) => {
    try {
        const { policyId } = req.params;
        
        const result = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
                AVG(confidence) FILTER (WHERE status = 'pending') as avg_pending_confidence
            FROM policy_tuning_suggestions
            WHERE policy_id = $1
        `, [policyId]);
        
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Failed to get summary', { error: error.message, policyId: req.params.policyId });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
