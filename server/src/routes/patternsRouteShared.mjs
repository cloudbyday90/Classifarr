/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendError } from '../utils/responseHelpers.mjs';
import {
    VALID_PRIORITIES,
    parseFloatParam,
    parseIntParam,
} from './patternsRouteHelpers.mjs';

export function createPatternsRouter({
    express,
    db,
    logger,
    patternMiningService,
    patternReinforcementService,
    embeddingRouter,
}) {
const router = express.Router();

router.get('/summary', asyncHandler(async (req, res) => {
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
        conflicts: Number.parseInt(conflictResult.rows[0].conflicts, 10),
        by_type: typeResult.rows,
    };

    res.json(summary);
}));

router.get('/cost-summary', asyncHandler(async (req, res) => {
    const result = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE method IN ('ai_verified', 'ai_analysis')) as calls_made,
                COUNT(*) FILTER (WHERE method IN ('learned_pattern', 'rule_match', 'exact_match', 'custom_rule')) as calls_avoided
            FROM classification_history
            WHERE created_at >= DATE_TRUNC('month', NOW())
        `);
    
    const data = result.rows[0];
    const callsMade = Number.parseInt(data.calls_made || 0, 10);
    const callsAvoided = Number.parseInt(data.calls_avoided || 0, 10);
    const totalCalls = callsMade + callsAvoided;
    const savingsPercent = totalCalls > 0 
        ? Math.round((callsAvoided / totalCalls) * 100) 
        : 0;
    
    res.json({
        callsMade,
        callsAvoided,
        savingsPercent,
        totalCalls,
    });
}));

router.post('/resolve-conflicts', asyncHandler(async (req, res) => {
    const result = await patternReinforcementService.resolveConflicts();
    logger.info('Conflicts resolved', result);
    res.json(result);
}));

router.post('/discover', asyncHandler(async (req, res) => {
    const result = await patternMiningService.discoverPatterns();
    logger.info('Pattern discovery triggered', result);
    res.json(result);
}));

router.post('/discover/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = parseIntParam(req.params.libraryId, null, 1);
    if (libraryId === null) {
        return sendError(res, 'Invalid library ID');
    }

    const result = await patternMiningService.discoverPatterns({ libraryId });
    logger.info('Library-specific pattern discovery triggered', { libraryId, result });
    res.json(result);
}));

router.get('/library/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = parseIntParam(req.params.libraryId, null, 1);
    if (libraryId === null) {
        return sendError(res, 'Invalid library ID');
    }

    const result = await db.query(`
            SELECT 
                dp.*,
                l.name as library_name,
                COUNT(pml.id) as match_count
            FROM discovered_patterns dp
            LEFT JOIN libraries l ON l.id = dp.library_id
            LEFT JOIN pattern_match_log pml ON pml.pattern_id = dp.id
            WHERE dp.library_id = $1
            GROUP BY dp.id, l.name
            ORDER BY dp.confidence DESC, dp.created_at DESC
        `, [libraryId]);

    res.json({ patterns: result.rows });
}));

router.get('/config', asyncHandler(async (req, res) => {
    const config = await embeddingRouter.getConfig();
    res.json({
        pattern_mining_enabled: config?.pattern_mining_enabled ?? true,
        pattern_rule_priority: config?.pattern_rule_priority || 'rules_first',
        pattern_ai_skip_threshold: config?.pattern_ai_skip_threshold || 90,
        pattern_notification_dismissed: config?.pattern_notification_dismissed || false,
        formula_pattern_weight: config?.formula_pattern_weight ?? 0.40,
        formula_rule_weight: config?.formula_rule_weight ?? 0.30,
        formula_rag_weight: config?.formula_rag_weight ?? 0.20,
        formula_history_weight: config?.formula_history_weight ?? 0.10,
    });
}));

router.put('/config', asyncHandler(async (req, res) => {
    const {
        pattern_mining_enabled,
        pattern_rule_priority,
        pattern_ai_skip_threshold,
        pattern_notification_dismissed,
        formula_pattern_weight,
        formula_rule_weight,
        formula_rag_weight,
        formula_history_weight,
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
        if (!VALID_PRIORITIES.includes(pattern_rule_priority)) {
            return sendError(res, `Invalid pattern_rule_priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
        }
        updates.push(`pattern_rule_priority = $${paramIndex}`);
        params.push(pattern_rule_priority);
        paramIndex++;
    }

    if (typeof pattern_ai_skip_threshold === 'number') {
        if (pattern_ai_skip_threshold < 0 || pattern_ai_skip_threshold > 100) {
            return sendError(res, 'pattern_ai_skip_threshold must be between 0 and 100');
        }
        updates.push(`pattern_ai_skip_threshold = $${paramIndex}`);
        params.push(pattern_ai_skip_threshold);
        paramIndex++;
    }

    if (typeof pattern_notification_dismissed === 'boolean') {
        updates.push(`pattern_notification_dismissed = $${paramIndex}`);
        params.push(pattern_notification_dismissed);
        paramIndex++;
    }

    if (typeof formula_pattern_weight === 'number') {
        if (formula_pattern_weight < 0 || formula_pattern_weight > 1) {
            return sendError(res, 'formula_pattern_weight must be between 0 and 1');
        }
        updates.push(`formula_pattern_weight = $${paramIndex}`);
        params.push(formula_pattern_weight);
        paramIndex++;
    }

    if (typeof formula_rule_weight === 'number') {
        if (formula_rule_weight < 0 || formula_rule_weight > 1) {
            return sendError(res, 'formula_rule_weight must be between 0 and 1');
        }
        updates.push(`formula_rule_weight = $${paramIndex}`);
        params.push(formula_rule_weight);
        paramIndex++;
    }

    if (typeof formula_rag_weight === 'number') {
        if (formula_rag_weight < 0 || formula_rag_weight > 1) {
            return sendError(res, 'formula_rag_weight must be between 0 and 1');
        }
        updates.push(`formula_rag_weight = $${paramIndex}`);
        params.push(formula_rag_weight);
        paramIndex++;
    }

    if (typeof formula_history_weight === 'number') {
        if (formula_history_weight < 0 || formula_history_weight > 1) {
            return sendError(res, 'formula_history_weight must be between 0 and 1');
        }
        updates.push(`formula_history_weight = $${paramIndex}`);
        params.push(formula_history_weight);
        paramIndex++;
    }

    const weightUpdates = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
    const hasWeightUpdates = weightUpdates.some((weight) => typeof weight === 'number');
    
    if (hasWeightUpdates) {
        const current = await db.query(
            'SELECT formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight FROM ai_provider_config WHERE id = 1',
        );
        const currentWeights = current.rows[0] || {};
        
        const finalPatternWeight = typeof formula_pattern_weight === 'number' ? formula_pattern_weight : (currentWeights.formula_pattern_weight ?? 0.40);
        const finalRuleWeight = typeof formula_rule_weight === 'number' ? formula_rule_weight : (currentWeights.formula_rule_weight ?? 0.30);
        const finalRagWeight = typeof formula_rag_weight === 'number' ? formula_rag_weight : (currentWeights.formula_rag_weight ?? 0.20);
        const finalHistoryWeight = typeof formula_history_weight === 'number' ? formula_history_weight : (currentWeights.formula_history_weight ?? 0.10);
        
        const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;
        
        if (sum < 0.99 || sum > 1.01) {
            return res.status(400).json({ 
                error: `Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`,
                currentSum: sum,
            });
        }
    }

    if (updates.length === 0) {
        return sendError(res, 'No valid updates provided');
    }

    const query = `
        UPDATE ai_provider_config
        SET ${updates.join(', ')}
        WHERE id = 1
        RETURNING 
            pattern_mining_enabled,
            pattern_rule_priority,
            pattern_ai_skip_threshold,
            pattern_notification_dismissed,
            formula_pattern_weight,
            formula_rule_weight,
            formula_rag_weight,
            formula_history_weight
    `;

    const result = await db.query(query, params);

    logger.info('Pattern config updated', result.rows[0]);
    res.json(result.rows[0]);
}));

router.get('/', asyncHandler(async (req, res) => {
    const {
        status,
        type,
        libraryId,
        min_confidence,
        search,
        page = 1,
        per_page = 30,
    } = req.query;

    const validatedPage = parseIntParam(page, 1, 1);
    const validatedPerPage = parseIntParam(per_page, 30, 1, 100);
    
    let validatedMinConfidence = null;
    if (min_confidence !== undefined && min_confidence !== '') {
        validatedMinConfidence = parseFloatParam(min_confidence, null, 0, 100);
        if (validatedMinConfidence === null) {
            return sendError(res, 'min_confidence must be a number between 0 and 100');
        }
    }

    let validatedLibraryId = null;
    if (libraryId !== undefined && libraryId !== '') {
        validatedLibraryId = parseIntParam(libraryId, null, 1);
        if (validatedLibraryId === null) {
            return sendError(res, 'libraryId must be a valid integer');
        }
    }

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

    if (validatedLibraryId !== null) {
        query += ` AND dp.library_id = $${paramIndex}`;
        params.push(validatedLibraryId);
        paramIndex++;
    }

    if (validatedMinConfidence !== null) {
        query += ` AND dp.confidence >= $${paramIndex}`;
        params.push(validatedMinConfidence);
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
    params.push(validatedPerPage);
    params.push((validatedPage - 1) * validatedPerPage);

    const result = await db.query(query, params);

    let countQuery = 'SELECT COUNT(DISTINCT dp.id) FROM discovered_patterns dp WHERE 1=1';
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
    if (validatedLibraryId !== null) {
        countQuery += ` AND dp.library_id = $${countParamIndex}`;
        countParams.push(validatedLibraryId);
        countParamIndex++;
    }
    if (validatedMinConfidence !== null) {
        countQuery += ` AND dp.confidence >= $${countParamIndex}`;
        countParams.push(validatedMinConfidence);
        countParamIndex++;
    }
    if (search) {
        countQuery += ` AND dp.pattern_value ILIKE $${countParamIndex}`;
        countParams.push(`%${search}%`);
        countParamIndex++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = Number.parseInt(countResult.rows[0].count, 10);

    res.json({
        patterns: result.rows,
        pagination: {
            page: validatedPage,
            per_page: validatedPerPage,
            total,
            total_pages: Math.ceil(total / validatedPerPage),
        },
    });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
        return sendError(res, 'Invalid pattern ID');
    }

    const patternResult = await db.query(`
        SELECT 
            dp.*,
            l.name as library_name
        FROM discovered_patterns dp
        LEFT JOIN libraries l ON l.id = dp.library_id
        WHERE dp.id = $1
    `, [id]);

    if (patternResult.rows.length === 0) {
        return sendError(res, 'Pattern not found', 404);
    }

    const pattern = patternResult.rows[0];
    const accuracy = await patternReinforcementService.getPatternAccuracy(id);
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
        recent_matches: historyResult.rows,
    });
}));

router.put('/:id/approve', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
        return sendError(res, 'Invalid pattern ID');
    }

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
        return sendError(res, 'Pattern not found', 404);
    }

    logger.info('Pattern approved', { id, approved_by });
    res.json(result.rows[0]);
}));

router.put('/:id/reject', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
        return sendError(res, 'Invalid pattern ID');
    }

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
        return sendError(res, 'Pattern not found', 404);
    }

    logger.info('Pattern rejected', { id, rejected_by, reason: rejection_reason });
    res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
        return sendError(res, 'Invalid pattern ID');
    }

    const result = await db.query(`
        DELETE FROM discovered_patterns
        WHERE id = $1
        RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
        return sendError(res, 'Pattern not found', 404);
    }

    logger.info('Pattern deleted', { id });
    res.json({ success: true, pattern: result.rows[0] });
}));

return router;
}
