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

// Threshold for fallback tier - items below this confidence get clarification tier
const LOW_CONFIDENCE_THRESHOLD = 70;

/**
 * Clamp confidence value between min and max
 * @param {number} value - Confidence value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clampConfidence(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

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
      // Round confidence to avoid decimal precision issues
      const roundedConfidence = Math.round(confidence);
      
      const result = await db.query(
        `SELECT * FROM confidence_thresholds 
         WHERE $1 >= min_confidence AND $1 <= max_confidence
         ORDER BY min_confidence DESC
         LIMIT 1`,
        [roundedConfidence]
      );

      if (result.rows.length === 0) {
        logger.warn('No tier found for confidence', { confidence, roundedConfidence });
        
        // Fallback tier for low-confidence items without explicit tier
        if (roundedConfidence < LOW_CONFIDENCE_THRESHOLD) {
          logger.info('Using fallback tier for low-confidence item', { confidence: roundedConfidence });
          return { 
            tier: 'clarify', 
            action: 'clarify_questions', 
            description: 'Requires clarification',
            min_confidence: 50,
            max_confidence: 69
          };
        }
        
        // Fallback tier for high-confidence items without explicit tier
        // This ensures all confidence ranges are covered, even with missing DB config
        logger.info(`Using fallback auto tier for high-confidence item with confidence: ${roundedConfidence}`);
        return {
          tier: 'auto',
          action: 'auto_route',
          description: 'High confidence - auto route',
          min_confidence: 70,  // Actual range starts at 70, not 90
          max_confidence: 100
        };
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting tier', { error: error.message, confidence });
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
      const confidenceAfter = clampConfidence(confidenceBefore + confidenceBoost);

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

  /**
   * Check if require all confirmations setting is enabled
   * @returns {Promise<boolean>} True if setting is enabled
   */
  async isRequireAllConfirmationsEnabled() {
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

  /**
   * Resolve a pending policy question and optionally generate a learned rule
   * v0.33 - Called when user selects an option from the pending queue
   * 
   * @param {number} classificationId - Classification history ID
   * @param {number} selectedLibraryId - The library ID user selected
   * @param {string} selectedOption - The option value selected
   * @param {string} resolvedBy - Who resolved (discord user ID or 'admin')
   * @param {boolean} generateRule - Whether to generate a learned pattern from this decision
   * @returns {Promise<object>} Resolution result
   */
  async resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule = true) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get the classification details
      const classResult = await client.query(
        `SELECT ch.*, l.name as library_name, l.arr_type 
         FROM classification_history ch
         LEFT JOIN libraries l ON l.id = $2
         WHERE ch.id = $1`,
        [classificationId, selectedLibraryId]
      );

      if (classResult.rows.length === 0) {
        throw new Error('Classification not found');
      }

      const classification = classResult.rows[0];
      const metadata = JSON.parse(classification.metadata || '{}');

      // Update classification to resolved status
      // method = 'manual_classification' since a human made this decision
      await client.query(
        `UPDATE classification_history 
         SET status = 'completed',
             library_id = $2,
             library_name = $3,
             confidence = 100,
             method = 'manual_classification',
             reason = $4,
             pending_reason = NULL
         WHERE id = $1`,
        [
          classificationId,
          selectedLibraryId,
          classification.library_name,
          `Resolved by ${resolvedBy}: ${selectedOption}`
        ]
      );

      // Optionally generate a learned pattern
      let learnedPattern = null;
      if (generateRule && metadata.tmdb_id) {
        // Check if this is a tmdb_id that was previously uncertain
        // Create an exact_match pattern so this exact item is remembered
        const patternResult = await client.query(
          `INSERT INTO learning_patterns 
           (tmdb_id, media_type, library_id, pattern_type, confidence, metadata, created_by)
           VALUES ($1, $2, $3, 'exact_match', 100, $4, $5)
           ON CONFLICT (tmdb_id, pattern_type) 
           DO UPDATE SET library_id = $3, confidence = 100, updated_at = NOW()
           RETURNING *`,
          [
            metadata.tmdb_id,
            classification.media_type,
            selectedLibraryId,
            JSON.stringify({
              title: classification.title,
              resolved_from: 'policy_question',
              original_question: classification.policy_question ? JSON.parse(classification.policy_question).question : null,
              selected_option: selectedOption,
            }),
            resolvedBy
          ]
        );
        learnedPattern = patternResult.rows[0];

        logger.info('Generated learned pattern from policy resolution', {
          tmdbId: metadata.tmdb_id,
          libraryId: selectedLibraryId,
          patternId: learnedPattern?.id
        });
      }

      // Log the resolution
      logger.info('Policy question resolved', {
        classificationId,
        selectedLibrary: classification.library_name,
        resolvedBy,
        generatedRule: !!learnedPattern
      });

      await client.query('COMMIT');

      return {
        success: true,
        classificationId,
        libraryId: selectedLibraryId,
        libraryName: classification.library_name,
        generatedPattern: learnedPattern,
        shouldRoute: true, // Signal that this should be routed to Radarr/Sonarr
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error resolving policy question', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all pending classifications awaiting policy decisions
   * @returns {Promise<Array>} Pending items
   */
  async getPendingClassifications() {
    try {
      const result = await db.query(
        `SELECT 
           ch.*,
           l.name as suggested_library_name,
           l.arr_type
         FROM classification_history ch
         LEFT JOIN libraries l ON l.id = ch.library_id
         WHERE ch.status = 'awaiting_decision'
         ORDER BY ch.created_at DESC`
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting pending classifications', { error: error.message });
      return [];
    }
  }
}

module.exports = new ClarificationService();
