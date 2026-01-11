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
const promptBuilder = require('../services/promptBuilder');
const feedbackAnalysis = require('../services/feedbackAnalysis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PromptsAPI');

/**
 * Prompts API Routes
 * API endpoints for prompt queue and response handling
 * 
 * @see https://github.com/cloudbyday90/Classifarr/issues/100
 */

/**
 * GET /api/prompts/pending
 * Get pending classification prompts queue
 */
router.get('/pending', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        
        // Get pending classifications from classification_history
        const result = await db.query(`
            SELECT 
                ch.id,
                ch.tmdb_id,
                ch.media_type,
                ch.title,
                ch.year,
                ch.metadata,
                ch.confidence,
                ch.pending_reason,
                ch.created_at,
                ch.classification_method
            FROM classification_history ch
            WHERE ch.status = 'pending'
            ORDER BY ch.created_at DESC
            LIMIT $1 OFFSET $2
        `, [parseInt(limit), parseInt(offset)]);
        
        const items = result.rows;
        
        // Get total count
        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM classification_history
            WHERE status = 'pending'
        `);
        
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
            success: true,
            data: {
                items,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: offset + items.length < total
                }
            }
        });
        
    } catch (error) {
        logger.error('Failed to get pending prompts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve pending prompts'
        });
    }
});

/**
 * GET /api/prompts/:id
 * Get specific prompt details with rich context
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get classification from history
        const result = await db.query(`
            SELECT 
                ch.id,
                ch.tmdb_id,
                ch.media_type,
                ch.title,
                ch.year,
                ch.metadata,
                ch.confidence,
                ch.pending_reason,
                ch.created_at,
                ch.classification_method,
                ch.classification_result
            FROM classification_history ch
            WHERE ch.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Prompt not found'
            });
        }
        
        const item = result.rows[0];
        
        // Parse metadata and classification result
        const metadata = typeof item.metadata === 'string' 
            ? JSON.parse(item.metadata) 
            : item.metadata;
        const evaluationResult = typeof item.classification_result === 'string'
            ? JSON.parse(item.classification_result)
            : item.classification_result || {};
        
        // Build rich prompt
        const prompt = await promptBuilder.buildPrompt(
            {
                title: item.title,
                year: item.year,
                media_type: item.media_type,
                tmdb_id: item.tmdb_id,
                ...metadata
            },
            evaluationResult
        );
        
        res.json({
            success: true,
            data: {
                id: item.id,
                prompt,
                createdAt: item.created_at
            }
        });
        
    } catch (error) {
        logger.error('Failed to get prompt details', { 
            error: error.message,
            promptId: req.params.id 
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve prompt details'
        });
    }
});

/**
 * POST /api/prompts/:id/respond
 * Submit prompt response with reason and pattern actions
 */
router.post('/:id/respond', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            selectedLibraryId,
            selectedPolicyId,
            reasons = [],
            customReason,
            patternActions = [],
            responseTime
        } = req.body;
        
        if (!selectedLibraryId) {
            return res.status(400).json({
                success: false,
                error: 'selectedLibraryId is required'
            });
        }
        
        // Get classification from history
        const classificationResult = await db.query(`
            SELECT 
                ch.id,
                ch.tmdb_id,
                ch.media_type,
                ch.title,
                ch.metadata,
                ch.classification_result,
                ch.created_at
            FROM classification_history ch
            WHERE ch.id = $1
        `, [id]);
        
        if (classificationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Classification not found'
            });
        }
        
        const classification = classificationResult.rows[0];
        const metadata = typeof classification.metadata === 'string'
            ? JSON.parse(classification.metadata)
            : classification.metadata;
        const evaluationResult = typeof classification.classification_result === 'string'
            ? JSON.parse(classification.classification_result)
            : classification.classification_result || {};
        
        // Determine if this was a correction
        const topSuggestion = evaluationResult.ranked && evaluationResult.ranked[0];
        const wasCorrection = topSuggestion 
            ? topSuggestion.library_id !== selectedLibraryId
            : false;
        
        // Record feedback
        const feedbackData = {
            tmdb_id: classification.tmdb_id,
            media_type: classification.media_type,
            title: classification.title,
            item_metadata: metadata,
            prompt_type: evaluationResult.action || 'prompt_select',
            original_scores: topSuggestion?.scores || {},
            top_suggestion_library_id: topSuggestion?.library_id,
            top_suggestion_score: topSuggestion?.score,
            selected_library_id: selectedLibraryId,
            selected_policy_id: selectedPolicyId,
            was_correction: wasCorrection,
            user_reason: reasons,
            user_reason_text: customReason,
            signal_analysis: evaluationResult.scores || {},
            patterns_created: patternActions,
            source: 'web',
            prompted_at: classification.created_at,
            responded_at: new Date()
        };
        
        const feedbackId = await feedbackAnalysis.recordFeedback(feedbackData);
        
        // Update classification status
        await db.query(`
            UPDATE classification_history
            SET 
                status = 'completed',
                library_id = $1,
                confidence = $2,
                updated_at = NOW()
            WHERE id = $3
        `, [selectedLibraryId, evaluationResult.confidence || 0, id]);
        
        // Create any requested patterns
        if (patternActions.length > 0) {
            for (const action of patternActions) {
                try {
                    await db.query(`
                        INSERT INTO discovered_patterns (
                            pattern_type,
                            pattern_value,
                            library_id,
                            confidence,
                            status,
                            source
                        )
                        VALUES ($1, $2, $3, 75, 'approved', 'user_feedback')
                        ON CONFLICT (pattern_type, pattern_value, library_id) DO UPDATE
                        SET confidence = GREATEST(discovered_patterns.confidence, 75),
                            status = 'approved',
                            updated_at = NOW()
                    `, [action.type, action.value, action.targetLibraryId || selectedLibraryId]);
                } catch (error) {
                    logger.warn('Failed to create pattern', {
                        error: error.message,
                        action
                    });
                }
            }
        }
        
        res.json({
            success: true,
            data: {
                feedbackId,
                classificationId: id,
                patternsCreated: patternActions.length
            }
        });
        
    } catch (error) {
        logger.error('Failed to submit prompt response', {
            error: error.message,
            promptId: req.params.id
        });
        res.status(500).json({
            success: false,
            error: 'Failed to submit response'
        });
    }
});

/**
 * GET /api/prompts/batch
 * Get batch summary of pending prompts
 */
router.get('/batch', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        // Get pending classifications
        const result = await db.query(`
            SELECT 
                ch.id,
                ch.tmdb_id,
                ch.media_type,
                ch.title,
                ch.year,
                ch.metadata,
                ch.confidence,
                ch.classification_result,
                ch.created_at
            FROM classification_history ch
            WHERE ch.status = 'pending'
            ORDER BY ch.created_at DESC
            LIMIT $1
        `, [parseInt(limit)]);
        
        const items = result.rows.map(item => {
            const metadata = typeof item.metadata === 'string'
                ? JSON.parse(item.metadata)
                : item.metadata;
            const evaluationResult = typeof item.classification_result === 'string'
                ? JSON.parse(item.classification_result)
                : item.classification_result || {};
            
            return {
                id: item.id,
                title: item.title,
                year: item.year,
                media_type: item.media_type,
                metadata,
                evaluation: evaluationResult
            };
        });
        
        // Build batch summary
        const batchSummary = promptBuilder.buildBatchSummary(items);
        
        res.json({
            success: true,
            data: batchSummary
        });
        
    } catch (error) {
        logger.error('Failed to get batch summary', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batch summary'
        });
    }
});

module.exports = router;
