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

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('clarificationService');

class ClarificationService {
  /**
   * Get confidence thresholds
   * @returns {Promise<Array>} Thresholds
   */
  async getThresholds() {
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

  /**
   * Get tier for confidence level
   * @param {number} confidence - Confidence level
   * @returns {Promise<object>} Tier information
   */
  async getTierForConfidence(confidence) {
    try {
      const result = await db.query(
        `SELECT * FROM confidence_thresholds 
         WHERE $1 >= min_confidence AND $1 <= max_confidence
         LIMIT 1`,
        [confidence]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting tier', { error: error.message });
      return null;
    }
  }

  /**
   * Match clarification questions to metadata
   * @param {object} metadata - Media metadata
   * @param {number} maxQuestions - Maximum questions to return
   * @returns {Promise<Array>} Matched questions
   */
  async matchQuestions(metadata, maxQuestions = 3) {
    try {
      // Get all enabled questions
      const result = await db.query(
        `SELECT * FROM clarification_questions 
         WHERE enabled = true
         ORDER BY priority DESC`
      );

      const questions = result.rows;
      const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
      const genres = (metadata.genres || []).map(g => g.toLowerCase());
      const originalLanguage = metadata.original_language || '';

      // Score each question
      const scoredQuestions = questions.map(question => {
        let score = 0;
        const reasons = [];

        // Score by keyword match (30 points max)
        const triggerKeywords = question.trigger_keywords || [];
        const keywordMatches = triggerKeywords.filter(tk => 
          keywords.includes(tk.toLowerCase())
        );
        if (keywordMatches.length > 0) {
          score += Math.min(keywordMatches.length * 15, 30);
          reasons.push(`Keyword match: ${keywordMatches.join(', ')}`);
        }

        // Score by genre match (20 points max)
        const triggerGenres = question.trigger_genres || [];
        const genreMatches = triggerGenres.filter(tg => 
          genres.includes(tg.toLowerCase())
        );
        if (genreMatches.length > 0) {
          score += Math.min(genreMatches.length * 10, 20);
          reasons.push(`Genre match: ${genreMatches.join(', ')}`);
        }

        // Language-specific question (40 points)
        if (question.question_type === 'language') {
          score += 40;
          reasons.push('Language clarification needed');
        }

        return {
          ...question,
          score,
          matchReasons: reasons
        };
      });

      // Sort by score and return top matches
      return scoredQuestions
        .filter(q => q.score > 0 || q.question_type === 'language')
        .sort((a, b) => b.score - a.score)
        .slice(0, maxQuestions);
    } catch (error) {
      logger.error('Error matching questions', { error: error.message });
      return [];
    }
  }

  /**
   * Record clarification response
   * @param {number} classificationId - Classification ID
   * @param {number} questionId - Question ID
   * @param {string} responseValue - Response value
   * @param {string} discordUserId - Discord user ID
   * @param {number} confidenceBefore - Confidence before response
   * @returns {Promise<object>} Response result
   */
  async recordResponse(classificationId, questionId, responseValue, discordUserId, confidenceBefore) {
    try {
      // Get question details
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

      // Calculate new confidence
      const confidenceBoost = selectedOption.confidence_boost || 0;
      const confidenceAfter = Math.max(0, Math.min(100, confidenceBefore + confidenceBoost));

      // Record response
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

      // Update classification status
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
        shouldReclassify: confidenceAfter >= 70 // Threshold for reclassification
      };
    } catch (error) {
      logger.error('Error recording response', { error: error.message });
      throw error;
    }
  }

  /**
   * Get clarification responses for a classification
   * @param {number} classificationId - Classification ID
   * @returns {Promise<Array>} Responses
   */
  async getResponses(classificationId) {
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

  /**
   * Get all clarification questions
   * @returns {Promise<Array>} Questions
   */
  async getAllQuestions() {
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

  /**
   * Create clarification question
   * @param {object} questionData - Question data
   * @returns {Promise<object>} Created question
   */
  async createQuestion(questionData) {
    try {
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
          questionData.response_options,
          questionData.priority || 0,
          questionData.enabled !== false
        ]
      );

      logger.info('Clarification question created', { id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating question', { error: error.message });
      throw error;
    }
  }

  /**
   * Update clarification question
   * @param {number} questionId - Question ID
   * @param {object} updates - Updates
   * @returns {Promise<object>} Updated question
   */
  async updateQuestion(questionId, updates) {
    try {
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
        values.push(updates.response_options);
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
    } catch (error) {
      logger.error('Error updating question', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete clarification question
   * @param {number} questionId - Question ID
   * @returns {Promise<boolean>} Success
   */
  async deleteQuestion(questionId) {
    try {
      await db.query(
        `DELETE FROM clarification_questions WHERE id = $1`,
        [questionId]
      );
      logger.info('Clarification question deleted', { id: questionId });
      return true;
    } catch (error) {
      logger.error('Error deleting question', { error: error.message });
      throw error;
    }
  }

  /**
   * Update confidence thresholds
   * @param {string} tier - Tier name
   * @param {object} updates - Updates
   * @returns {Promise<object>} Updated threshold
   */
  async updateThreshold(tier, updates) {
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
}

module.exports = new ClarificationService();
