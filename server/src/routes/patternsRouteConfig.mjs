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
import { ValidationError } from '../utils/appError.mjs';
import { VALID_PRIORITIES } from './patternsRouteHelpers.mjs';

export function registerConfigRoutes(router, { db, embeddingRouter, logger }) {
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
        throw new ValidationError(`Invalid pattern_rule_priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }
      updates.push(`pattern_rule_priority = $${paramIndex}`);
      params.push(pattern_rule_priority);
      paramIndex++;
    }

    if (typeof pattern_ai_skip_threshold === 'number') {
      if (pattern_ai_skip_threshold < 0 || pattern_ai_skip_threshold > 100) {
        throw new ValidationError('pattern_ai_skip_threshold must be between 0 and 100');
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
        throw new ValidationError('formula_pattern_weight must be between 0 and 1');
      }
      updates.push(`formula_pattern_weight = $${paramIndex}`);
      params.push(formula_pattern_weight);
      paramIndex++;
    }

    if (typeof formula_rule_weight === 'number') {
      if (formula_rule_weight < 0 || formula_rule_weight > 1) {
        throw new ValidationError('formula_rule_weight must be between 0 and 1');
      }
      updates.push(`formula_rule_weight = $${paramIndex}`);
      params.push(formula_rule_weight);
      paramIndex++;
    }

    if (typeof formula_rag_weight === 'number') {
      if (formula_rag_weight < 0 || formula_rag_weight > 1) {
        throw new ValidationError('formula_rag_weight must be between 0 and 1');
      }
      updates.push(`formula_rag_weight = $${paramIndex}`);
      params.push(formula_rag_weight);
      paramIndex++;
    }

    if (typeof formula_history_weight === 'number') {
      if (formula_history_weight < 0 || formula_history_weight > 1) {
        throw new ValidationError('formula_history_weight must be between 0 and 1');
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
        throw new ValidationError(
          `Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`,
          { currentSum: sum },
        );
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
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
}
