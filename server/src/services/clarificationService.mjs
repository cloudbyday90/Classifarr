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
import * as policyQuestionContext from '../utils/policyQuestionContext.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

import { SEED_INTEGRITY_CACHE_TTL_MS, createStatusError, safeParseJson, parsePolicyQuestion, getQuestionOptionLibraryIds, clampConfidence } from './clarificationUtils.mjs';
import { getAllQuestions, createQuestion, updateQuestion, deleteQuestion, matchQuestions, hasLanguagePresets as _hasLanguagePresets, isLanguageQuestionAllowed as _isLanguageQuestionAllowed } from './clarificationQuestionManager.mjs';
import { getThresholds, getTierForConfidence, getTierFromPolicyThresholds, isRequireAllConfirmationsEnabled, updateThreshold, recordResponse, getResponses } from './clarificationThresholdManager.mjs';

export { LOW_CONFIDENCE_THRESHOLD, SEED_INTEGRITY_CACHE_TTL_MS, clampConfidence, createStatusError, safeParseJson, parsePolicyQuestion, getQuestionOptionLibraryIds } from './clarificationUtils.mjs';
export { getAllQuestions, createQuestion, updateQuestion, deleteQuestion, matchQuestions, hasLanguagePresets, isLanguageQuestionAllowed } from './clarificationQuestionManager.mjs';
export { getThresholds, getTierForConfidence, getTierFromPolicyThresholds, isRequireAllConfirmationsEnabled, updateThreshold, recordResponse, getResponses } from './clarificationThresholdManager.mjs';

const logger = createLogger('clarificationService');

class ClarificationService {
  constructor(deps = {}) {
    this.policyQuestionContext = deps.policyQuestionContext || policyQuestionContext;
    this.seedIntegrityCacheTtlMs = Number.isFinite(Number(deps.seedIntegrityCacheTtlMs))
      ? Number(deps.seedIntegrityCacheTtlMs)
      : SEED_INTEGRITY_CACHE_TTL_MS;
    this.seedIntegritySnapshot = null;
    this.seedIntegrityWarnings = new Set();
  }

  createStatusError(...args) { return createStatusError(...args); }
  parsePolicyQuestion(...args) { return parsePolicyQuestion(...args); }
  safeParseJson(...args) { return safeParseJson(...args); }
  getQuestionOptionLibraryIds(...args) { return getQuestionOptionLibraryIds(...args); }
  getTierFromPolicyThresholds(...args) { return getTierFromPolicyThresholds(...args); }
  isRequireAllConfirmationsEnabled(...args) { return isRequireAllConfirmationsEnabled(...args); }
  getResponses(...args) { return getResponses(...args); }
  async hasLanguagePresets(...args) { return _hasLanguagePresets(...args); }
  async isLanguageQuestionAllowed(...args) { return _isLanguageQuestionAllowed(...args); }

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

  async getThresholds(...args) { return getThresholds(...args); }

  async getTierForConfidence(confidence) {
    return getTierForConfidence(confidence, { auditSeedIntegrity: (opts) => this.auditSeedIntegrity(opts) });
  }

  async getAllQuestions(...args) { return getAllQuestions(...args); }

  async createQuestion(questionData) {
    const result = await createQuestion(questionData);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async updateQuestion(...args) { return updateQuestion(...args); }

  async deleteQuestion(questionId) {
    const result = await deleteQuestion(questionId);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async updateThreshold(tier, updates) {
    const result = await updateThreshold(tier, updates);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async matchQuestions(metadata, maxQuestions = 3) {
    return matchQuestions(metadata, maxQuestions, {
      auditSeedIntegrity: (opts) => this.auditSeedIntegrity(opts)
    });
  }

  async recordResponse(...args) { return recordResponse(...args); }

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
        throw createStatusError('Invalid library_id', 400, 'invalid_library_id');
      }

      const selectedLibrary = selectedLibraryResult.rows[0];
      if (selectedLibrary.is_active !== true) {
        throw createStatusError('Selected library is inactive', 400, 'inactive_library');
      }

      const classificationMediaType = String(classification.media_type || '').toLowerCase();
      const selectedLibraryMediaType = String(selectedLibrary.media_type || '').toLowerCase();
      if (
        classificationMediaType &&
        selectedLibraryMediaType &&
        classificationMediaType !== selectedLibraryMediaType
      ) {
        throw createStatusError(
          'Selected library is not valid for this media type',
          400,
          'library_media_type_mismatch'
        );
      }

      const policyQuestion = parsePolicyQuestion(classification.policy_question);
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
          throw createStatusError(
            'Policy question is stale and must be retried',
            409,
            'policy_question_stale'
          );
        }

        const optionLibraryIds = getQuestionOptionLibraryIds(policyQuestion);
        if (optionLibraryIds.length > 0 && !optionLibraryIds.includes(selectedLibraryId)) {
          throw createStatusError(
            'Selected library is no longer valid for this policy question',
            400,
            'invalid_policy_option'
          );
        }
      }

      const selectedLibraryName = selectedLibrary.name || classification.library_name;
      const metadata = typeof classification.metadata === 'string'
        ? (safeParseJson(classification.metadata) || {})
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
              ? safeParseJson(row.policy_question)
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
}

export const clarificationService = new ClarificationService();
