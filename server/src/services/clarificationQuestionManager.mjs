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
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

const logger = createLogger('clarificationService');

export async function getAllQuestions() {
  try {
    const result = await db.query(
      `SELECT * FROM clarification_questions ORDER BY priority DESC, id ASC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting questions', { error: error.message });
    return [];
  }
}

export async function createQuestion(questionData) {
  return withServiceCatch(logger, 'Error creating question', async () => {
    const result = await db.query(
      `INSERT INTO clarification_questions 
       (question_text, question_type, trigger_keywords, trigger_genres, 
        response_options, priority, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        questionData.question_text,
        questionData.question_type,
        questionData.trigger_keywords || [],
        questionData.trigger_genres || [],
        typeof questionData.response_options === 'string' ? questionData.response_options : JSON.stringify(questionData.response_options),
        questionData.priority || 0,
        questionData.enabled !== false
      ]
    );

    logger.info('Clarification question created', { id: result.rows[0].id });
    return result.rows[0];
  });
}

export async function updateQuestion(questionId, updates) {
  return withServiceCatch(logger, 'Error updating question', async () => {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.question_text !== undefined) {
      fields.push(`question_text = $${paramIndex++}`);
      values.push(updates.question_text);
    }
    if (updates.trigger_keywords !== undefined) {
      fields.push(`trigger_keywords = $${paramIndex++}`);
      values.push(updates.trigger_keywords);
    }
    if (updates.trigger_genres !== undefined) {
      fields.push(`trigger_genres = $${paramIndex++}`);
      values.push(updates.trigger_genres);
    }
    if (updates.response_options !== undefined) {
      fields.push(`response_options = $${paramIndex++}`);
      values.push(typeof updates.response_options === 'string' ? updates.response_options : JSON.stringify(updates.response_options));
    }
    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }

    values.push(questionId);

    const result = await db.query(
      `UPDATE clarification_questions 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  });
}

export async function deleteQuestion(questionId) {
  return withServiceCatch(logger, 'Error deleting question', async () => {
    await db.query(
      `DELETE FROM clarification_questions WHERE id = $1`,
      [questionId]
    );
    logger.info('Clarification question deleted', { id: questionId });
    return true;
  });
}

export async function hasLanguagePresets(mediaType = null) {
  try {
    const params = [];
    let mediaTypeClause = '';

    if (mediaType) {
      params.push(mediaType);
      mediaTypeClause = 'AND l.media_type = $1';
    }

    const result = await db.query(
      `SELECT 1
       FROM policy_presets pp
       JOIN content_presets cp ON cp.id = pp.preset_id
       JOIN library_policies lp ON lp.id = pp.policy_id AND lp.enabled = true
       JOIN libraries l ON l.id = lp.library_id AND l.is_active = true
       WHERE cp.signals ? 'language'
       ${mediaTypeClause}
       LIMIT 1`,
      params
    );

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking language presets', { error: error.message });
    return false;
  }
}

export async function isLanguageQuestionAllowed(metadata) {
  const originalLanguage = (metadata?.original_language || '').toLowerCase();
  if (originalLanguage && originalLanguage === 'en') {
    return false;
  }

  const mediaType = metadata?.media_type ? metadata.media_type.toLowerCase() : null;
  return hasLanguagePresets(mediaType);
}

export async function matchQuestions(metadata, maxQuestions = 3, { auditSeedIntegrity } = {}) {
  try {
    const allowLanguageQuestion = await isLanguageQuestionAllowed(metadata);

    const result = await db.query(
      `SELECT * FROM clarification_questions 
       WHERE enabled = true
       ORDER BY priority DESC`
    );

    const questions = result.rows;
    if (questions.length === 0 && auditSeedIntegrity) {
      await auditSeedIntegrity({ source: 'clarification_questions' });
    }
    const keywords = normalizeMetadataListLower(metadata.keywords);
    const genres = normalizeMetadataListLower(metadata.genres);

    const scoredQuestions = questions.map(question => {
      let score = 0;
      const reasons = [];

      const triggerKeywords = question.trigger_keywords || [];
      const keywordMatches = triggerKeywords.filter(tk =>
        keywords.includes(tk.toLowerCase())
      );
      if (keywordMatches.length > 0) {
        score += Math.min(keywordMatches.length * 15, 30);
        reasons.push(`Keyword match: ${keywordMatches.join(', ')}`);
      }

      const triggerGenres = question.trigger_genres || [];
      const genreMatches = triggerGenres.filter(tg =>
        genres.includes(tg.toLowerCase())
      );
      if (genreMatches.length > 0) {
        score += Math.min(genreMatches.length * 10, 20);
        reasons.push(`Genre match: ${genreMatches.join(', ')}`);
      }

      if (question.question_type === 'language' && allowLanguageQuestion) {
        score += 40;
        reasons.push('Language clarification needed');
      }

      return {
        ...question,
        score,
        matchReasons: reasons
      };
    });

    return scoredQuestions
      .filter(q => q.score > 0 || (allowLanguageQuestion && q.question_type === 'language'))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxQuestions);
  } catch (error) {
    logger.error('Error matching questions', { error: error.message });
    return [];
  }
}
