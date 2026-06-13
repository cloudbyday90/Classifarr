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
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/appError.mjs';

export function registerRulesRoutes(router, { db, mediaSyncService, requireReadWrite, logger }) {
    router.post('/:id/sync', requireReadWrite, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { incremental = false, batchSize = 100 } = req.body;

        logger.info('Starting library sync', { libraryId: id, incremental });

        const result = await mediaSyncService.syncLibrary(parseInt(id), {
            incremental,
            batchSize,
        });

        res.json(result);
    }));

    router.get('/:id/rules', asyncHandler(async (req, res) => {
        const { id } = req.params;

        const result = await db.query(
            `SELECT * FROM library_rules_v2 
           WHERE library_id = $1 
           ORDER BY priority ASC, created_at DESC`,
            [id]
        );

        res.json(result.rows);
    }));

    router.post('/:id/rules', requireReadWrite, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, description, conditions, is_active = true, priority = 0 } = req.body;

        let conditionsArray = conditions;
        if (!conditions && req.body.rule_type) {
            conditionsArray = [{
                field: req.body.rule_type,
                operator: req.body.operator,
                value: req.body.value,
            }];
        }

        if (!conditionsArray || !Array.isArray(conditionsArray) || conditionsArray.length === 0) {
            throw new ValidationError('conditions array is required');
        }

        const ruleName = name || conditionsArray.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ');

        const result = await db.query(
            `INSERT INTO library_rules_v2 (library_id, name, description, conditions, is_active, priority)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
            [id, ruleName, description, JSON.stringify(conditionsArray), is_active, priority]
        );

        logger.info('Library rule created', { libraryId: id, name: ruleName });
        res.status(201).json(result.rows[0]);
    }));

    router.get('/:id/rules/debug-insert', requireReadWrite, asyncHandler(async (req, res) => {
        if (process.env.NODE_ENV === 'production') {
            throw new ForbiddenError('Debug endpoint not available in production');
        }

        const { id } = req.params;
        const result = await db.query(
            `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
           VALUES ($1, 'keyword', 'contains', 'debug_test', false, 0, 'Debug Rule')
           RETURNING *`,
            [id]
        );
        res.json(result.rows[0]);
    }));

    router.put('/:id/rules/:ruleId', requireReadWrite, asyncHandler(async (req, res) => {
        const { id, ruleId } = req.params;
        const { name, description, conditions, is_active, priority } = req.body;

        const result = await db.query(
            `UPDATE library_rules_v2 
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               conditions = COALESCE($3, conditions),
               is_active = COALESCE($4, is_active),
               priority = COALESCE($5, priority),
               updated_at = NOW()
           WHERE id = $6 AND library_id = $7
           RETURNING *`,
            [name, description, conditions ? JSON.stringify(conditions) : null, is_active, priority, ruleId, id]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Rule not found');
        }

        res.json(result.rows[0]);
    }));

    router.delete('/:id/rules/:ruleId', requireReadWrite, asyncHandler(async (req, res) => {
        const { id, ruleId } = req.params;

        const result = await db.query(
            `DELETE FROM library_rules_v2 WHERE id = $1 AND library_id = $2 RETURNING id`,
            [ruleId, id]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Rule not found');
        }

        res.json({ success: true, deletedId: result.rows[0].id });
    }));

    router.post('/:id/rules/preview', asyncHandler(async (req, res) => {
        const { id } = req.params;
        let { criteria } = req.body;

        if (!criteria) {
            throw new ValidationError('criteria is required');
        }

        let query = 'SELECT * FROM media_server_items WHERE library_id = $1';
        const params = [id];
        let paramIndex = 2;

        if (!Array.isArray(criteria)) {
            criteria = [criteria];
        }

        for (const condition of criteria) {
            const { field, operator, value } = condition;

            if (!value || (Array.isArray(value) && value.length === 0)) {
                continue;
            }

            switch (field) {
                case 'content_type':
                    if (operator === 'is_one_of') {
                        const types = Array.isArray(value) ? value : [value];
                        query += ` AND metadata->'content_analysis'->>'type' = ANY($${paramIndex})`;
                        params.push(types);
                    } else {
                        query += ` AND metadata->'content_analysis'->>'type' = $${paramIndex}`;
                        params.push(value);
                    }
                    paramIndex++;
                    break;

                case 'genres':
                    if (operator === 'contains') {
                        query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
                        params.push(value);
                        paramIndex++;
                    } else if (operator === 'is_one_of') {
                        const genres = Array.isArray(value) ? value : [value];
                        query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = ANY(SELECT LOWER(unnest($${paramIndex}::text[]))))`;
                        params.push(genres);
                        paramIndex++;
                    } else if (operator === 'not_contains') {
                        query += ` AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
                        params.push(value);
                        paramIndex++;
                    }
                    break;

                case 'keywords':
                case 'tags':
                    if (operator === 'contains') {
                        query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) AS t WHERE LOWER(t) LIKE LOWER($${paramIndex}))`;
                        params.push(`%${value}%`);
                        paramIndex++;
                    }
                    break;

                case 'title':
                    if (operator === 'contains') {
                        query += ` AND LOWER(title) LIKE LOWER($${paramIndex})`;
                        params.push(`%${value}%`);
                        paramIndex++;
                    }
                    break;

                case 'year':
                    if (operator === 'equals') {
                        query += ` AND year = $${paramIndex}`;
                        params.push(parseInt(value));
                    } else if (operator === 'greater_than') {
                        query += ` AND year > $${paramIndex}`;
                        params.push(parseInt(value));
                    } else if (operator === 'less_than') {
                        query += ` AND year < $${paramIndex}`;
                        params.push(parseInt(value));
                    } else if (operator === 'between' && value.includes(',')) {
                        const [min, max] = value.split(',').map((v) => parseInt(v.trim()));
                        query += ` AND year >= $${paramIndex} AND year <= $${paramIndex + 1}`;
                        params.push(min, max);
                        paramIndex++;
                    }
                    paramIndex++;
                    break;

                case 'certification':
                case 'content_rating':
                    if (operator === 'equals') {
                        query += ` AND (metadata->>'content_rating' = $${paramIndex} OR metadata->>'certification' = $${paramIndex})`;
                        params.push(value);
                    } else if (operator === 'is_one_of') {
                        const certs = Array.isArray(value) ? value : [value];
                        query += ` AND (metadata->>'content_rating' = ANY($${paramIndex}) OR metadata->>'certification' = ANY($${paramIndex}))`;
                        params.push(certs);
                    }
                    paramIndex++;
                    break;

                case 'original_language':
                    if (operator === 'equals') {
                        query += ` AND metadata->>'original_language' = $${paramIndex}`;
                        params.push(value);
                        paramIndex++;
                    } else if (operator === 'is_one_of') {
                        const langs = Array.isArray(value) ? value : [value];
                        query += ` AND metadata->>'original_language' = ANY($${paramIndex})`;
                        params.push(langs);
                        paramIndex++;
                    }
                    break;
            }
        }

        query += ' ORDER BY added_at DESC LIMIT 50';

        const result = await db.query(query, params);
        res.json(result.rows);
    }));
}
