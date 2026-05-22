/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';
import { policyThresholdIntegrityService } from './policyThresholdIntegrityService.mjs';
import { clampConfidence, LOW_CONFIDENCE_THRESHOLD } from './clarificationUtils.mjs';

const logger = createLogger('clarificationService');

export async function getThresholds() {
  try {
    const result = await db.query(
      `SELECT * FROM confidence_thresholds ORDER BY min_confidence DESC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting thresholds', { error: error.message });
    return [];
  }
}

export async function getTierForConfidence(confidence, { auditSeedIntegrity } = {}) {
  try {
    const roundedConfidence = Math.round(confidence);

    const result = await db.query(
      `SELECT * FROM confidence_thresholds 
       WHERE $1 >= min_confidence AND $1 <= max_confidence
       ORDER BY min_confidence DESC
       LIMIT 1`,
      [roundedConfidence]
    );

    if (result.rows.length === 0) {
      let seedIntegrity = null;
      if (auditSeedIntegrity) {
        seedIntegrity = await auditSeedIntegrity({ source: 'clarification_tiering' });
      }
      if (!seedIntegrity || seedIntegrity.thresholdCount > 0) {
        logger.warn('No tier found for confidence', { confidence, roundedConfidence });
      }

      if (roundedConfidence < LOW_CONFIDENCE_THRESHOLD) {
        logger.info('Using fallback tier for low-confidence item', {
          confidence: roundedConfidence,
          reason: seedIntegrity?.thresholdCount === 0 ? 'confidence_thresholds_missing' : 'confidence_gap_uncovered'
        });
        return {
          tier: 'clarify',
          action: 'clarify_questions',
          description: 'Requires clarification',
          min_confidence: 50,
          max_confidence: 69
        };
      }

      logger.info('Using fallback auto tier for high-confidence item', {
        confidence: roundedConfidence,
        reason: seedIntegrity?.thresholdCount === 0 ? 'confidence_thresholds_missing' : 'confidence_gap_uncovered'
      });
      return {
        tier: 'auto',
        action: 'auto_route',
        description: 'High confidence - auto route',
        min_confidence: 70,
        max_confidence: 100
      };
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting tier', { error: error.message, confidence });
    return null;
  }
}

export function getTierFromPolicyThresholds(
  confidence,
  thresholds,
  requireAllConfirmations = false,
) {
  if (!thresholds) return null;

  const normalizedThresholds = normalizePolicyDecisionThresholds(thresholds);
  policyThresholdIntegrityService.warnOnNormalizedThresholds({
    source: 'clarification_tiering',
    thresholds,
    normalizedThresholds,
  });

  const auto = clampConfidence(normalizedThresholds.autoClassifyThreshold);
  const prompt = clampConfidence(normalizedThresholds.promptThreshold);
  const roundedConfidence = Math.round(clampConfidence(confidence));

  if (!requireAllConfirmations && roundedConfidence >= auto) {
    return {
      tier: 'auto',
      action: 'auto_route',
      description: 'Policy threshold met - auto route',
      min_confidence: auto,
      max_confidence: 100,
    };
  }

  if (roundedConfidence >= prompt) {
    return {
      tier: 'verify',
      action: 'verify_buttons',
      description: 'Policy threshold met - verify',
      min_confidence: prompt,
      max_confidence: Math.max(auto - 1, prompt),
    };
  }

  return null;
}

export async function isRequireAllConfirmationsEnabled() {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'require_all_confirmations'"
    );
    return result.rows[0]?.value === 'true';
  } catch (error) {
    logger.error('Error checking require_all_confirmations setting', { error: error.message });
    return false;
  }
}

export async function updateThreshold(tier, updates) {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.min_confidence !== undefined) {
      fields.push(`min_confidence = $${paramIndex++}`);
      values.push(updates.min_confidence);
    }
    if (updates.max_confidence !== undefined) {
      fields.push(`max_confidence = $${paramIndex++}`);
      values.push(updates.max_confidence);
    }
    if (updates.action !== undefined) {
      fields.push(`action = $${paramIndex++}`);
      values.push(updates.action);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    values.push(tier);

    const result = await db.query(
      `UPDATE confidence_thresholds 
       SET ${fields.join(', ')}
       WHERE tier = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating threshold', { error: error.message });
    throw error;
  }
}

export async function recordResponse(classificationId, questionId, responseValue, discordUserId, confidenceBefore) {
  try {
    const questionResult = await db.query(
      `SELECT * FROM clarification_questions WHERE id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      throw new Error('Question not found');
    }

    const question = questionResult.rows[0];
    const responseOptions = question.response_options;
    const selectedOption = responseOptions[responseValue];

    if (!selectedOption) {
      throw new Error('Invalid response value');
    }

    const confidenceBoost = selectedOption.confidence_boost || 0;
    const confidenceAfter = clampConfidence(confidenceBefore + confidenceBoost);

    const result = await db.query(
      `INSERT INTO clarification_responses 
       (classification_id, question_id, discord_user_id, response_value, 
        response_label, confidence_before, confidence_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        classificationId,
        questionId,
        discordUserId,
        responseValue,
        selectedOption.label,
        confidenceBefore,
        confidenceAfter
      ]
    );

    await db.query(
      `UPDATE classification_history 
       SET clarification_status = $1, confidence = $2
       WHERE id = $3`,
      ['responded', confidenceAfter, classificationId]
    );

    logger.info('Clarification response recorded', {
      classificationId,
      questionId,
      confidenceBefore,
      confidenceAfter
    });

    return {
      success: true,
      response: result.rows[0],
      confidenceAfter,
      shouldReclassify: confidenceAfter >= 70
    };
  } catch (error) {
    logger.error('Error recording response', { error: error.message });
    throw error;
  }
}

export async function getResponses(classificationId) {
  try {
    const result = await db.query(
      `SELECT cr.*, cq.question_text, cq.question_type
       FROM clarification_responses cr
       JOIN clarification_questions cq ON cr.question_id = cq.id
       WHERE cr.classification_id = $1
       ORDER BY cr.created_at ASC`,
      [classificationId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting responses', { error: error.message });
    return [];
  }
}
