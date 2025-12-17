const db = require('../config/database');

class ClarificationService {
  /**
   * Determine what action to take based on confidence
   */
  async getActionForConfidence(confidence) {
    const result = await db.query(`
      SELECT * FROM confidence_thresholds 
      WHERE $1 >= min_confidence AND $1 <= max_confidence AND enabled = true
      ORDER BY min_confidence DESC
      LIMIT 1
    `, [confidence]);
    
    return result.rows[0] || { action_type: 'manual', min_confidence: 0, max_confidence: 49 };
  }

  /**
   * Get relevant clarification questions for this media
   */
  async getQuestionsForMedia(metadata, classificationResult) {
    const { media_type, genres, keywords, original_language } = metadata;
    const questions = [];
    
    // Query questions that match this media's characteristics
    const allQuestions = await db.query(`
      SELECT * FROM clarification_questions 
      WHERE enabled = true 
      AND (applies_to = $1 OR applies_to = 'both')
      ORDER BY priority DESC
    `, [media_type]);
    
    for (const q of allQuestions.rows) {
      let shouldAsk = false;
      
      // Check keyword triggers
      if (q.trigger_keywords && keywords && keywords.length > 0) {
        const keywordMatch = q.trigger_keywords.some(tk => 
          keywords.some(k => k.toLowerCase().includes(tk.toLowerCase()))
        );
        if (keywordMatch) shouldAsk = true;
      }
      
      // Check genre triggers
      if (q.trigger_genres && genres && genres.length > 0) {
        const genreMatch = q.trigger_genres.some(tg =>
          genres.some(g => g.toLowerCase() === tg.toLowerCase())
        );
        if (genreMatch) shouldAsk = true;
      }
      
      // Check language triggers
      if (q.trigger_languages && original_language) {
        if (q.trigger_languages.includes(original_language)) {
          shouldAsk = true;
        }
      }
      
      if (shouldAsk) {
        questions.push({
          id: q.id,
          key: q.question_key,
          type: q.question_type,
          text: q.question_text,
          options: q.options
        });
      }
    }
    
    // Limit questions based on confidence (lower confidence = more questions)
    const maxQuestions = classificationResult.confidence < 50 ? 3 : 2;
    return questions.slice(0, maxQuestions);
  }

  /**
   * Get a question by its key
   */
  async getQuestionByKey(questionKey) {
    const result = await db.query(
      'SELECT * FROM clarification_questions WHERE question_key = $1',
      [questionKey]
    );
    return result.rows[0];
  }

  /**
   * Process a clarification response
   */
  async processResponse(classificationId, questionKey, selectedValue, userId, userName) {
    // 1. Get the question and selected option
    const question = await this.getQuestionByKey(questionKey);
    if (!question) {
      throw new Error(`Question not found: ${questionKey}`);
    }

    const selectedOption = question.options.find(o => o.value === selectedValue);
    if (!selectedOption) {
      throw new Error(`Invalid option: ${selectedValue}`);
    }
    
    // 2. Save the response
    await db.query(`
      INSERT INTO clarification_responses 
      (classification_id, question_id, question_key, question_text, selected_option, selected_value, applied_labels, responded_by, responded_by_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      classificationId, 
      question.id, 
      questionKey, 
      question.question_text, 
      JSON.stringify(selectedOption), 
      selectedValue, 
      selectedOption.maps_to_labels || [], 
      userName || 'Unknown',
      userId
    ]);
    
    // 3. Apply labels to classification metadata
    await this.applyLabelsToClassification(classificationId, selectedOption.maps_to_labels || []);
    
    // 4. Update clarification status
    await db.query(`
      UPDATE classification_history 
      SET clarification_questions_answered = clarification_questions_answered + 1,
          updated_at = NOW()
      WHERE id = $1
    `, [classificationId]);
    
    // 5. Check if all questions answered
    const classification = await this.getClassification(classificationId);
    if (classification.clarification_questions_answered >= classification.clarification_questions_asked) {
      // Re-classify with new information
      return await this.reclassifyWithClarifications(classificationId);
    }
    
    return { status: 'pending_more_answers' };
  }

  /**
   * Apply labels to classification
   */
  async applyLabelsToClassification(classificationId, labels) {
    if (!labels || labels.length === 0) return;

    // Get current classification
    const result = await db.query(
      'SELECT metadata FROM classification_history WHERE id = $1',
      [classificationId]
    );

    if (result.rows.length === 0) return;

    const metadata = result.rows[0].metadata || {};
    const clarifiedLabels = metadata.clarified_labels || [];
    
    // Add new labels
    const updatedLabels = [...new Set([...clarifiedLabels, ...labels])];
    
    // Update metadata
    await db.query(
      `UPDATE classification_history 
       SET metadata = jsonb_set(metadata, '{clarified_labels}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(updatedLabels), classificationId]
    );
  }

  /**
   * Get classification by ID
   */
  async getClassification(classificationId) {
    const result = await db.query(
      'SELECT * FROM classification_history WHERE id = $1',
      [classificationId]
    );
    return result.rows[0];
  }

  /**
   * Get responses for a classification
   */
  async getResponsesForClassification(classificationId) {
    const result = await db.query(
      'SELECT * FROM clarification_responses WHERE classification_id = $1 ORDER BY created_at',
      [classificationId]
    );
    return result.rows;
  }

  /**
   * Re-classify after receiving clarifications
   */
  async reclassifyWithClarifications(classificationId) {
    const classification = await this.getClassification(classificationId);
    const responses = await this.getResponsesForClassification(classificationId);
    
    // Build enhanced metadata with clarification responses
    const enhancedMetadata = {
      ...classification.metadata,
      clarified_labels: responses.flatMap(r => r.applied_labels || []),
      clarification_context: responses.map(r => ({
        question: r.question_key,
        answer: r.selected_value
      }))
    };
    
    // Re-run classification logic with enhanced metadata
    const classificationService = require('./classification');
    const result = await classificationService.runDecisionTree(enhancedMetadata, classification.media_type);
    
    // Update classification
    await db.query(`
      UPDATE classification_history
      SET clarification_status = 'completed',
          confidence_after_clarification = $1,
          library_id = $2,
          reason = $3,
          method = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [
      result.confidence, 
      result.library?.id, 
      result.reason, 
      result.method,
      classificationId
    ]);
    
    // Save learning pattern
    await this.savePatternFromClarification(classificationId, responses);
    
    return {
      status: 'completed',
      library: result.library,
      confidence: result.confidence,
      reason: result.reason,
      method: result.method
    };
  }

  /**
   * Save learning pattern from clarification
   */
  async savePatternFromClarification(classificationId, responses) {
    const classification = await this.getClassification(classificationId);
    
    // Create patterns for each clarification response
    for (const response of responses) {
      try {
        await db.query(`
          INSERT INTO learning_patterns 
          (tmdb_id, library_id, pattern_type, pattern_data, confidence)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          classification.tmdb_id,
          classification.library_id,
          `clarification_${response.question_key}`,
          JSON.stringify({
            question_key: response.question_key,
            selected_value: response.selected_value,
            applied_labels: response.applied_labels
          }),
          75.00 // Initial confidence for learned patterns
        ]);
      } catch (error) {
        console.error('Error saving pattern:', error);
      }
    }
  }

  /**
   * Confirm classification (user verified it's correct)
   */
  async confirmClassification(classificationId, userId) {
    await db.query(
      `UPDATE classification_history 
       SET status = 'completed',
           metadata = metadata || jsonb_build_object('confirmed_by', $2, 'confirmed_at', NOW())
       WHERE id = $1`,
      [classificationId, userId]
    );
  }

  /**
   * Get clarification statistics
   */
  async getStats() {
    const result = await db.query(`
      SELECT 
        clarification_status,
        COUNT(*) as count,
        AVG(confidence_after_clarification - confidence) as avg_improvement
      FROM classification_history
      WHERE clarification_status != 'none'
      GROUP BY clarification_status
    `);
    
    return result.rows;
  }
}

module.exports = new ClarificationService();
