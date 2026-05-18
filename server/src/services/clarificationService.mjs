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
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { policyThresholdIntegrityService } from './policyThresholdIntegrityService.mjs';
import * as policyQuestionContext from '../utils/policyQuestionContext.mjs';
import { normalizeMetadataList, normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { normalizePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';

const logger = createLogger('clarificationService');

const LOW_CONFIDENCE_THRESHOLD = 70;
const SEED_INTEGRITY_CACHE_TTL_MS = 5 * 60 * 1000;

function clampConfidence(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

class ClarificationService {
  constructor(deps = {}) {
    this.policyQuestionContext = deps.policyQuestionContext || policyQuestionContext;
    this.seedIntegrityCacheTtlMs = Number.isFinite(Number(deps.seedIntegrityCacheTtlMs))
      ? Number(deps.seedIntegrityCacheTtlMs)
      : SEED_INTEGRITY_CACHE_TTL_MS;
    this.seedIntegritySnapshot = null;
    this.seedIntegrityWarnings = new Set();
  }

  createStatusError(message, statusCode, code = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) {
      error.code = code;
    }
    return error;
  }

  parsePolicyQuestion(value) {
    if (!value) return null;
    return typeof value === 'string' ? this.safeParseJson(value) : value;
  }

  invalidateSeedIntegrityCache() {
    this.seedIntegritySnapshot = null;
  }

  async getSeedIntegritySummary({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.seedIntegritySnapshot && (now - this.seedIntegritySnapshot.checkedAt) < this.seedIntegrityCacheTtlMs) {
      return this.seedIntegritySnapshot.summary;
    }

    try {
      const result = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM confidence_thresholds) AS threshold_count,
          (SELECT COUNT(*)::int FROM clarification_questions) AS question_count
      `);

      const row = result.rows[0] || {};
      const summary = {
        thresholdCount: Number.parseInt(row.threshold_count, 10) || 0,
        questionCount: Number.parseInt(row.question_count, 10) || 0,
      };

      this.seedIntegritySnapshot = {
        checkedAt: now,
        summary,
      };

      return summary;
    } catch (error) {
      logger.error('Error checking clarification seed integrity', { error: error.message });
      return null;
    }
  }

  async auditSeedIntegrity({ source = 'runtime' } = {}) {
    const summary = await this.getSeedIntegritySummary();
    if (!summary) {
      return null;
    }

    const missing = [];
    if (summary.thresholdCount === 0) {
      missing.push('confidence_thresholds');
    }
    if (summary.questionCount === 0) {
      missing.push('clarification_questions');
    }

    if (missing.length === 0) {
      return summary;
    }

    const warningKey = missing.slice().sort().join('|');
    if (!this.seedIntegrityWarnings.has(warningKey)) {
      this.seedIntegrityWarnings.add(warningKey);
      logger.warn('Clarification seed data missing or incomplete; fallback clarification behavior will be used', {
        source,
        missing,
        thresholdCount: summary.thresholdCount,
        questionCount: summary.questionCount,
      });
    }

    return summary;
  }

  getQuestionOptionLibraryIds(question) {
    if (!question || !Array.isArray(question.options)) {
      return [];
    }

    return Array.from(new Set(
      question.options
        .map((option) => Number.parseInt(option?.library_id, 10))
        .filter((libraryId) => Number.isInteger(libraryId) && libraryId > 0)
    ));
  }

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

  async getTierForConfidence(confidence) {
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
        const seedIntegrity = await this.auditSeedIntegrity({ source: 'clarification_tiering' });
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

  getTierFromPolicyThresholds(
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

  async matchQuestions(metadata, maxQuestions = 3) {
    try {
      const allowLanguageQuestion = await this.isLanguageQuestionAllowed(metadata);

      const result = await db.query(
        `SELECT * FROM clarification_questions 
         WHERE enabled = true
         ORDER BY priority DESC`
      );

      const questions = result.rows;
      if (questions.length === 0) {
        await this.auditSeedIntegrity({ source: 'clarification_questions' });
      }
      const keywords = normalizeMetadataListLower(metadata.keywords);
      const genres = normalizeMetadataListLower(metadata.genres);
      const originalLanguage = metadata.original_language || '';
      void originalLanguage;

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

  async isLanguageQuestionAllowed(metadata) {
    const originalLanguage = (metadata?.original_language || '').toLowerCase();
    if (originalLanguage && originalLanguage === 'en') {
      return false;
    }

    const mediaType = metadata?.media_type ? metadata.media_type.toLowerCase() : null;
    return this.hasLanguagePresets(mediaType);
  }

  async hasLanguagePresets(mediaType = null) {
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

  async recordResponse(classificationId, questionId, responseValue, discordUserId, confidenceBefore) {
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

      this.invalidateSeedIntegrityCache();
      logger.info('Clarification question created', { id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating question', { error: error.message });
      throw error;
    }
  }

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

  async deleteQuestion(questionId) {
    try {
      await db.query(
        `DELETE FROM clarification_questions WHERE id = $1`,
        [questionId]
      );
      this.invalidateSeedIntegrityCache();
      logger.info('Clarification question deleted', { id: questionId });
      return true;
    } catch (error) {
      logger.error('Error deleting question', { error: error.message });
      throw error;
    }
  }

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

      this.invalidateSeedIntegrityCache();
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating threshold', { error: error.message });
      throw error;
    }
  }

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

  async resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule = true) {
    try {
      const result = await db.withTransaction(async (client) => {

      const classResult = await client.query(
        `SELECT ch.*
         FROM classification_history ch
         WHERE ch.id = $1
           AND ch.status = 'awaiting_decision'
         FOR UPDATE`,
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        const libraryCheck = await client.query(
          'SELECT id FROM libraries WHERE id = $1',
          [selectedLibraryId]
        );

        if (libraryCheck.rows.length === 0) {
          const invalidLibraryError = new Error('Invalid library_id');
          invalidLibraryError.statusCode = 400;
          throw invalidLibraryError;
        }

        const existenceCheck = await client.query(
          `SELECT status, library_id, library_name
           FROM classification_history
           WHERE id = $1`,
          [classificationId]
        );

        if (existenceCheck.rows.length === 0) {
          const notFoundError = new Error('Classification not found');
          notFoundError.statusCode = 404;
          throw notFoundError;
        }

        const existingClassification = existenceCheck.rows[0];
        const existingLibraryId = Number(existingClassification.library_id);
        if (
          existingClassification.status &&
          ['completed', 'routed'].includes(existingClassification.status) &&
          Number.isInteger(existingLibraryId) &&
          existingLibraryId === selectedLibraryId
        ) {
          return {
            success: true,
            classificationId,
            libraryId: selectedLibraryId,
            libraryName: existingClassification.library_name || null,
            generatedPattern: null,
            shouldRoute: false,
            alreadyResolved: true,
          };
        }

        const staleResolutionError = new Error('Classification is no longer awaiting decision');
        staleResolutionError.statusCode = 409;
        throw staleResolutionError;
      }

      const classification = classResult.rows[0];
      const selectedLibraryResult = await client.query(
        `SELECT id, name, arr_type, media_type, is_active
         FROM libraries
         WHERE id = $1`,
        [selectedLibraryId]
      );

      if (selectedLibraryResult.rows.length === 0) {
        throw this.createStatusError('Invalid library_id', 400, 'invalid_library_id');
      }

      const selectedLibrary = selectedLibraryResult.rows[0];
      if (selectedLibrary.is_active !== true) {
        throw this.createStatusError('Selected library is inactive', 400, 'inactive_library');
      }

      const classificationMediaType = String(classification.media_type || '').toLowerCase();
      const selectedLibraryMediaType = String(selectedLibrary.media_type || '').toLowerCase();
      if (
        classificationMediaType &&
        selectedLibraryMediaType &&
        classificationMediaType !== selectedLibraryMediaType
      ) {
        throw this.createStatusError(
          'Selected library is not valid for this media type',
          400,
          'library_media_type_mismatch'
        );
      }

      const policyQuestion = this.parsePolicyQuestion(classification.policy_question);
      if (policyQuestion) {
        const {
          extractQuestionContext,
          getPolicyQuestionContextVersion,
          isPolicyQuestionStale,
        } = this.policyQuestionContext;
        const currentContextVersion = await getPolicyQuestionContextVersion(
          client,
          extractQuestionContext(policyQuestion)
        );

        if (isPolicyQuestionStale(policyQuestion, currentContextVersion)) {
          throw this.createStatusError(
            'Policy question is stale and must be retried',
            409,
            'policy_question_stale'
          );
        }

        const optionLibraryIds = this.getQuestionOptionLibraryIds(policyQuestion);
        if (optionLibraryIds.length > 0 && !optionLibraryIds.includes(selectedLibraryId)) {
          throw this.createStatusError(
            'Selected library is no longer valid for this policy question',
            400,
            'invalid_policy_option'
          );
        }
      }

      const selectedLibraryName = selectedLibrary.name || classification.library_name;
      const metadata = typeof classification.metadata === 'string'
        ? (this.safeParseJson(classification.metadata) || {})
        : (classification.metadata || {});

      await client.query(
        `UPDATE classification_history 
         SET status = 'completed',
             library_id = $2,
             library_name = $3,
             confidence = 100,
             method = 'manual_classification',
             reason = $4,
             pending_reason = NULL,
             policy_question = NULL
         WHERE id = $1`,
        [
          classificationId,
          selectedLibraryId,
          selectedLibraryName,
          `Resolved by ${resolvedBy}: ${selectedOption}`
        ]
      );

      await classificationOutcomeService.recordOutcome(classificationId, {
        type: 'resolved',
        source: 'policy_question',
        actor: resolvedBy,
        selected_option: selectedOption || null,
        final_library_id: selectedLibraryId,
        final_library_name: selectedLibraryName
      }, { client });

      let learnedPattern = null;
      if (generateRule && metadata.tmdb_id) {

        learnedPattern = await classificationEvidenceService.rememberExactMatch({
          tmdbId: metadata.tmdb_id,
          mediaType: classification.media_type,
          libraryId: selectedLibraryId,
          payload: {
            title: classification.title,
            resolved_from: 'policy_question',
            original_question: policyQuestion?.question || null,
            selected_option: selectedOption,
          },
          createdBy: resolvedBy,
          client,
          payloadColumn: 'metadata',
          conflictMode: 'update_metadata'
        });

        logger.info('Generated learned pattern from policy resolution', {
          tmdbId: metadata.tmdb_id,
          libraryId: selectedLibraryId,
          patternId: learnedPattern?.id
        });

        const itemGenres = normalizeMetadataList(metadata.genres);
        if (itemGenres.length > 0) {
          await classificationEvidenceService.reinforceGenrePatterns({
            mediaType: classification.media_type,
            libraryId: selectedLibraryId,
            genres: itemGenres,
            createdBy: resolvedBy,
            client
          });
          logger.info('Wrote genre patterns from policy resolution', {
            genres: itemGenres,
            libraryId: selectedLibraryId,
            mediaType: classification.media_type
          });
        }
      }

      logger.info('Policy question resolved', {
        classificationId,
        selectedLibrary: classification.library_name,
        resolvedBy,
        generatedRule: !!learnedPattern
      });

      return {
        success: true,
        classificationId,
        libraryId: selectedLibraryId,
        libraryName: selectedLibraryName,
        generatedPattern: learnedPattern,
        shouldRoute: true,
      };
      }); // end withTransaction
      return result;
    } catch (error) {
      if (error.statusCode && error.statusCode < 500) {
        logger.warn('Policy question resolution rejected', {
          classificationId,
          selectedLibraryId,
          statusCode: error.statusCode,
          error: error.message
        });
      } else {
        logger.error('Error resolving policy question', { error: error.message }, { error });
      }
      throw error;
    }
  }

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
      const contextVersionCache = new Map();
      const {
        buildQuestionContextCacheKey,
        extractQuestionContext,
        getPolicyQuestionContextVersion,
        isPolicyQuestionStale,
      } = this.policyQuestionContext;

      const items = await Promise.all(result.rows.map(async (row) => {
        const parsedQuestion = row.policy_question
          ? (typeof row.policy_question === 'string'
              ? this.safeParseJson(row.policy_question)
              : row.policy_question)
          : null;

        if (!parsedQuestion) {
          return {
            ...row,
            policy_question: null,
            policy_question_stale: false,
            policy_question_current_context_version: null,
            policy_question_stale_reason: null,
          };
        }

        const context = extractQuestionContext(parsedQuestion);
        const cacheKey = buildQuestionContextCacheKey(context);

        let currentContextVersion = contextVersionCache.get(cacheKey);
        if (currentContextVersion === undefined) {
          currentContextVersion = await getPolicyQuestionContextVersion(db, context);
          contextVersionCache.set(cacheKey, currentContextVersion);
        }

        const questionStale = isPolicyQuestionStale(parsedQuestion, currentContextVersion);

        return {
          ...row,
          policy_question: parsedQuestion,
          policy_question_stale: questionStale,
          policy_question_current_context_version: currentContextVersion,
          policy_question_stale_reason: questionStale ? 'policy_context_changed' : null,
        };
      }));

      return items;
    } catch (error) {
      logger.error('Error getting pending classifications', { error: error.message });
      return [];
    }
  }

  safeParseJson(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      logger.warn('Failed to parse policy_question JSON', { error: error.message });
      return null;
    }
  }
}

export const clarificationService = new ClarificationService();
