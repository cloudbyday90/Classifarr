const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('clarification');

class ClarificationService {
  /**
   * Get action for a given confidence level
   */
  async getActionForConfidence(confidence) {
    try {
      const result = await db.query(
        `SELECT action FROM confidence_thresholds 
         WHERE enabled = true 
         AND $1 >= min_confidence 
         AND $1 <= max_confidence
         LIMIT 1`,
        [Math.round(confidence)]
      );

      if (result.rows.length > 0) {
        return result.rows[0].action;
      }

      // Default fallback
      if (confidence >= 90) return 'auto_route';
      if (confidence >= 70) return 'route_and_verify';
      if (confidence >= 50) return 'ask_questions';
      return 'manual_review';
    } catch (error) {
      logger.error('Failed to get action for confidence', { error: error.message });
      return 'manual_review';
    }
  }

  /**
   * Get clarification questions that match the media metadata
   */
  async getQuestionsForMedia(metadata, maxQuestions = 2) {
    try {
      const { media_type, keywords = [], genres = [], original_language } = metadata;

      // Get all enabled questions that apply to this media type
      const result = await db.query(
        `SELECT * FROM clarification_questions 
         WHERE enabled = true 
         AND (applies_to = $1 OR applies_to = 'both')
         ORDER BY priority DESC`,
        [media_type]
      );

      const questions = result.rows;
      const matchedQuestions = [];

      for (const question of questions) {
        let score = 0;
        const reasons = [];

        // Check keyword matches
        if (question.trigger_keywords && question.trigger_keywords.length > 0) {
          const keywordMatches = keywords.filter(k => 
            question.trigger_keywords.some(tk => 
              k.toLowerCase().includes(tk.toLowerCase()) ||
              tk.toLowerCase().includes(k.toLowerCase())
            )
          );
          if (keywordMatches.length > 0) {
            score += 30 * keywordMatches.length;
            reasons.push(`Keywords: ${keywordMatches.join(', ')}`);
          }
        }

        // Check genre matches
        if (question.trigger_genres && question.trigger_genres.length > 0) {
          const genreMatches = genres.filter(g =>
            question.trigger_genres.some(tg =>
              g.toLowerCase().includes(tg.toLowerCase()) ||
              tg.toLowerCase().includes(g.toLowerCase())
            )
          );
          if (genreMatches.length > 0) {
            score += 20 * genreMatches.length;
            reasons.push(`Genres: ${genreMatches.join(', ')}`);
          }
        }

        // Check language matches
        if (question.trigger_languages && question.trigger_languages.length > 0) {
          if (question.trigger_languages.includes(original_language)) {
            score += 40;
            reasons.push(`Language: ${original_language}`);
          }
        }

        if (score > 0) {
          matchedQuestions.push({
            ...question,
            match_score: score,
            match_reasons: reasons,
          });
        }
      }

      // Sort by score and return top N
      matchedQuestions.sort((a, b) => b.match_score - a.match_score);
      return matchedQuestions.slice(0, maxQuestions);
    } catch (error) {
      logger.error('Failed to get questions for media', { error: error.message });
      return [];
    }
  }

  /**
   * Process a clarification response
   */
  async processResponse(classificationId, questionKey, selectedValue, respondedBy = 'user') {
    try {
      // Get the question
      const questionResult = await db.query(
        'SELECT * FROM clarification_questions WHERE question_key = $1',
        [questionKey]
      );

      if (questionResult.rows.length === 0) {
        throw new Error(`Question not found: ${questionKey}`);
      }

      const question = questionResult.rows[0];
      const options = question.options;

      // Find the selected option
      const selectedOption = options.find(opt => opt.value === selectedValue);
      if (!selectedOption) {
        throw new Error(`Invalid option selected: ${selectedValue}`);
      }

      const appliedLabels = selectedOption.maps_to_labels || [];

      // Save the response
      await db.query(
        `INSERT INTO clarification_responses 
         (classification_id, question_id, question_key, selected_value, applied_labels, responded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [classificationId, question.id, questionKey, selectedValue, appliedLabels, respondedBy]
      );

      logger.info('Clarification response processed', {
        classificationId,
        questionKey,
        selectedValue,
        appliedLabels,
      });

      return {
        success: true,
        appliedLabels,
        reclassificationNeeded: true,
      };
    } catch (error) {
      logger.error('Failed to process clarification response', { error: error.message });
      throw error;
    }
  }

  /**
   * Reclassify with clarification responses applied
   */
  async reclassifyWithClarifications(classificationId) {
    try {
      // Get original classification
      const classResult = await db.query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        throw new Error(`Classification not found: ${classificationId}`);
      }

      const classification = classResult.rows[0];
      const metadata = classification.metadata || {};

      // Get all clarification responses
      const responsesResult = await db.query(
        'SELECT * FROM clarification_responses WHERE classification_id = $1',
        [classificationId]
      );

      // Enhance metadata with clarification labels
      const clarificationLabels = [];
      for (const response of responsesResult.rows) {
        clarificationLabels.push(...(response.applied_labels || []));
      }

      metadata.clarification_labels = clarificationLabels;

      // Store original confidence
      const confidenceBeforeClarification = classification.confidence;

      // Re-run classification with enhanced metadata
      const classificationService = require('./classification');
      
      // Get all libraries
      const librariesResult = await db.query(
        'SELECT * FROM libraries WHERE media_type = $1 AND is_active = true ORDER BY priority DESC',
        [classification.media_type]
      );

      const libraries = librariesResult.rows;

      // Re-match rules with clarification labels
      const ruleMatch = await classificationService.matchRules(metadata, libraries);

      if (ruleMatch && ruleMatch.library) {
        // Update classification
        await db.query(
          `UPDATE classification_history 
           SET library_id = $1, 
               confidence = $2, 
               reason = $3,
               confidence_before_clarification = $4,
               confidence_after_clarification = $2,
               clarification_status = 'completed'
           WHERE id = $5`,
          [
            ruleMatch.library.id,
            ruleMatch.confidence,
            ruleMatch.reason,
            confidenceBeforeClarification,
            classificationId,
          ]
        );

        logger.info('Reclassification completed', {
          classificationId,
          library: ruleMatch.library.name,
          confidenceBefore: confidenceBeforeClarification,
          confidenceAfter: ruleMatch.confidence,
        });

        return {
          success: true,
          library: ruleMatch.library,
          confidenceBefore: confidenceBeforeClarification,
          confidenceAfter: ruleMatch.confidence,
        };
      }

      return {
        success: false,
        error: 'No matching library found after clarification',
      };
    } catch (error) {
      logger.error('Reclassification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Save a learning pattern from a successful clarification
   */
  async savePatternFromClarification(classificationId) {
    try {
      // Get classification with responses
      const classResult = await db.query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        return;
      }

      const classification = classResult.rows[0];

      // Only save patterns for high-confidence results after clarification
      if (!classification.confidence_after_clarification || 
          classification.confidence_after_clarification < 75) {
        return;
      }

      const responsesResult = await db.query(
        'SELECT * FROM clarification_responses WHERE classification_id = $1',
        [classificationId]
      );

      if (responsesResult.rows.length === 0) {
        return;
      }

      // Create pattern from clarification
      const metadata = classification.metadata || {};
      const responses = responsesResult.rows;

      const patternData = {
        genres: metadata.genres || [],
        keywords: metadata.keywords || [],
        clarifications: responses.map(r => ({
          question_key: r.question_key,
          selected_value: r.selected_value,
          applied_labels: r.applied_labels,
        })),
      };

      await db.query(
        `INSERT INTO learning_patterns 
         (library_id, pattern_type, pattern_data, confidence, source, tmdb_id)
         VALUES ($1, 'clarification_pattern', $2, $3, 'clarification', $4)
         ON CONFLICT (tmdb_id) DO UPDATE
         SET pattern_data = EXCLUDED.pattern_data,
             confidence = EXCLUDED.confidence,
             updated_at = NOW()`,
        [
          classification.library_id,
          JSON.stringify(patternData),
          classification.confidence_after_clarification,
          classification.tmdb_id,
        ]
      );

      logger.info('Learning pattern saved from clarification', {
        classificationId,
        libraryId: classification.library_id,
      });
    } catch (error) {
      logger.error('Failed to save learning pattern', { error: error.message });
    }
  }

  /**
   * Get clarification statistics
   */
  async getStats() {
    try {
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_clarifications,
          AVG(confidence_after_clarification - confidence_before_clarification) as avg_improvement,
          COUNT(CASE WHEN confidence_after_clarification >= 75 THEN 1 END) as successful_count
        FROM classification_history
        WHERE clarification_status = 'completed'
      `);

      const questionStatsResult = await db.query(`
        SELECT 
          cq.question_key,
          cq.question_text,
          COUNT(cr.id) as times_asked,
          COUNT(DISTINCT cr.selected_value) as unique_responses
        FROM clarification_questions cq
        LEFT JOIN clarification_responses cr ON cq.id = cr.question_id
        WHERE cq.enabled = true
        GROUP BY cq.id, cq.question_key, cq.question_text
        ORDER BY times_asked DESC
      `);

      return {
        overall: statsResult.rows[0] || {},
        byQuestion: questionStatsResult.rows || [],
      };
    } catch (error) {
      logger.error('Failed to get clarification stats', { error: error.message });
      return { overall: {}, byQuestion: [] };
    }
  }
}

module.exports = new ClarificationService();
