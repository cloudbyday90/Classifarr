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
import { embeddingService } from './embeddingService.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as policyQuestionContext from '../utils/policyQuestionContext.mjs';
import * as ragErrorHandler from '../utils/ragErrorHandler.mjs';
import { buildRagLoopSummary } from './classificationPersistenceServiceShared.mjs';
import { persistRagLoopStageEvents as _persistRagLoopStageEvents } from './classificationPersistenceRagEvents.mjs';
import { rebindRetryLineage as _rebindRetryLineage } from './classificationPersistenceRetryLineage.mjs';

const logger = createLogger('classificationPersistence');

function summarizeRankedCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  return {
    library_id: candidate.library_id ?? null,
    library_name: candidate.library_name ?? null,
    policy_id: candidate.policy_id ?? null,
    policy_name: candidate.policy_name ?? null,
    score: candidate.score ?? null,
    candidate_diagnostics: candidate.candidate_diagnostics || candidate.candidateDiagnostics || null,
  };
}

export class ClassificationPersistenceService {
  constructor(deps = {}) {
    this.policyQuestionContext = deps.policyQuestionContext || policyQuestionContext;
    this.ragErrorHandler = deps.ragErrorHandler || ragErrorHandler;
  }

  async getRagErrorHandler() {
    return this.ragErrorHandler;
  }

  async _createAwaitingDecisionNotification(classificationId, title, reason, mediaType) {
    try {
      await db.query(
        `INSERT INTO app_notifications (type, title, message, data, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          'warning',
          `${title} needs attention`,
          reason || 'Manual review required',
          JSON.stringify({
            notificationType: 'awaiting_decision',
            classificationId,
            mediaType,
            targetPath: '/',
            targetAnchor: 'needs-attention',
            dismissible: false,
          }),
        ],
      );
      logger.debug('Created awaiting_decision notification', { classificationId, title });
    } catch (error) {
      logger.error('Failed to create awaiting_decision notification', {
        classificationId,
        title,
        error: error.message,
      });
    }
  }

  async isRealtimeEmbeddingEnabled() {
    try {
      const result = await db.query(
        'SELECT realtime_embedding_enabled FROM ai_provider_config WHERE id = 1',
      );
      return result.rows.length > 0 ? result.rows[0].realtime_embedding_enabled : true;
    } catch (_error) {
      return true;
    }
  }

  async normalizePolicyQuestion(value) {
    if (!value) {
      return null;
    }
    let parsed = null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return null;
      }
      try {
        parsed = JSON.parse(trimmed);
      } catch (_error) {
        return null;
      }
    } else if (typeof value === 'object') {
      parsed = value;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    try {
      const {
        extractQuestionContext,
        getPolicyQuestionContextVersion,
        stampPolicyQuestionContext,
      } = this.policyQuestionContext;
      const context = extractQuestionContext(parsed);
      const contextVersion = await getPolicyQuestionContextVersion(db, context);
      parsed = stampPolicyQuestionContext(parsed, contextVersion, context);
    } catch (error) {
      logger.warn('Failed to stamp policy question context', {
        title: parsed?.question || null,
        error: error.message,
      });
    }

    return JSON.stringify(parsed);
  }

  buildRagLoopSummary(result = {}) {
    return buildRagLoopSummary(result);
  }

  async deriveClassificationPersistenceState(result) {
    let status;
    if (result.needs_retry) {
      status = 'pending_retry';
    } else {
      status = (
        result.needs_clarification ||
        result.method === 'fallback' ||
        (result.confidence && result.confidence < 70)
      ) ? 'awaiting_decision' : 'completed';
    }

    const isAwaitingDecision = status === 'awaiting_decision' || status === 'pending_retry';
    const libraryId = isAwaitingDecision ? null : (result.library?.id || result.library?.library_id || null);
    const libraryName = isAwaitingDecision ? null : (result.library?.name || result.library?.library_name || null);
    const pendingReason = status === 'completed'
      ? null
      : (result.pending_reason || (status === 'awaiting_decision' ? result.reason : null));
    const policyQuestion = status === 'awaiting_decision'
      ? await this.normalizePolicyQuestion(result.policy_question || result.clarification)
      : null;

    let profileSnapshot = null;
    if (libraryId && status === 'completed') {
      try {
        const profileStats = await libraryProfileService.getProfileStats(libraryId);
        profileSnapshot = JSON.stringify(profileStats);
      } catch (error) {
        logger.warn('Failed to get profile snapshot for classification', {
          libraryId,
          error: error.message,
        });
      }
    }

    return {
      status,
      libraryId,
      libraryName,
      pendingReason,
      policyQuestion,
      profileSnapshot,
    };
  }

  async logClassification(metadata, result, startTime = null) {
    const collectionId = metadata.collectionId || null;
    const signalsJson = result.signals ? JSON.stringify(result.signals)
      : result.signalContext?.signals ? JSON.stringify(result.signalContext.signals) : null;

    const {
      status,
      libraryId,
      libraryName,
      pendingReason,
      policyQuestion,
      profileSnapshot,
    } = await this.deriveClassificationPersistenceState(result);

    const ragContext = result.ragContext || result.signalContext?.ragContext || null;
    const ragTopMatch = ragContext?.similarItems?.[0] || null;
    const ragDetails = ragTopMatch ? {
      combined_similarity: ragTopMatch.similarity ?? null,
      text_similarity: ragTopMatch.textSimilarity ?? null,
      image_similarity: ragTopMatch.imageSimilarity ?? null,
      text_weight: ragTopMatch.textWeight ?? null,
      image_weight: ragTopMatch.imageWeight ?? null,
    } : null;

    const classificationDetails = {
      policy_name: result.policyResult?.library?.policy_name || null,
      scores: result.policyResult?.scores || { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
      weights: result.policyResult?.weights || { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      candidate_diagnostics: result.policyResult?.candidateDiagnostics
        || result.policyResult?.ranked?.[0]?.candidate_diagnostics
        || null,
      ranked_candidates: Array.isArray(result.policyResult?.ranked)
        ? result.policyResult.ranked.slice(0, 5).map(summarizeRankedCandidate).filter(Boolean)
        : [],
      rag_details: ragDetails,
      rag_loop_trace: result.ragLoopTrace || null,
      rag_loop_summary: this.buildRagLoopSummary(result),
      parse_diagnostics: result.parse_diagnostics || null,
      processing_time_ms: startTime ? Date.now() - startTime : null,
    };

    const enrichedMetadata = {
      ...metadata,
      classification_details: classificationDetails,
    };

    const graphRel = ragGraphExtractor.extract(enrichedMetadata);

    const insertResult = await db.query(
      `INSERT INTO classification_history 
       (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status, collection_id, signals_json, pending_reason, policy_question, profile_snapshot, retry_after, retry_count, max_retries, director_name, primary_studio_name, genre_names, cast_ids, cast_names)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       RETURNING id`,
      [
        enrichedMetadata.tmdb_id,
        enrichedMetadata.media_type,
        enrichedMetadata.title,
        enrichedMetadata.year,
        libraryId,
        libraryName,
        result.confidence,
        result.method,
        result.reason,
        JSON.stringify(enrichedMetadata),
        status,
        collectionId,
        signalsJson,
        pendingReason,
        policyQuestion,
        profileSnapshot,
        result.retry_after || null,
        result.retry_count || 0,
        result.max_retries || 3,
        graphRel.director_name,
        graphRel.primary_studio_name,
        graphRel.genre_names,
        graphRel.cast_ids,
        graphRel.cast_names,
      ],
    );

    const classificationId = insertResult.rows[0].id;

    if (result.needs_clarification) {
      logger.info('Classification pending - awaiting clarification', {
        id: classificationId,
        title: enrichedMetadata.title,
        reason: pendingReason,
      });
    }

    if (status === 'awaiting_decision') {
      await this._createAwaitingDecisionNotification(
        classificationId,
        enrichedMetadata.title,
        pendingReason || result.reason,
        enrichedMetadata.media_type,
      );
    }

    if (enrichedMetadata.contentAnalysis && enrichedMetadata.contentAnalysis.bestMatch) {
      await contentTypeAnalyzer.analyze(enrichedMetadata, classificationId);
    }

    if (status === 'completed' && result.library) {
      const realtimeEnabled = await this.isRealtimeEmbeddingEnabled();

      if (realtimeEnabled) {
        try {
          await embeddingService.generateAndStore(classificationId, {
            ...enrichedMetadata,
            library_name: libraryName,
          });
        } catch (embedError) {
          if (embedError.message === 'PROVIDER_OFFLINE') {
            logger.debug('[Embedding] Real-time generation deferred: provider unavailable', {
              id: classificationId,
              retryAt: embedError.cooldownUntil || null,
            });
          } else if (embeddingService.isProviderBusyError(embedError)) {
            logger.debug('[Embedding] Real-time generation deferred: provider busy', {
              id: classificationId,
              lockHolder: embedError.lockHolder || null,
              waitMs: embedError.waitMs || null,
              activeModel: embedError.activeModel || null,
            });
          } else {
            logger.error('[Embedding] Real-time generation failed, will retry in backfill', {
              id: classificationId,
              error: embedError.message,
            }, { error: embedError });
          }
        }
      } else {
        setImmediate(async () => {
          try {
            await embeddingService.generateAndStore(classificationId, {
              ...enrichedMetadata,
              library_name: libraryName,
            });
          } catch (_embedError) {
            logger.debug('Embedding generation deferred', { id: classificationId });
          }
        });
      }
    }

    return classificationId;
  }

  async persistRagLoopStageEvents(params) {
    return _persistRagLoopStageEvents(params, this.ragErrorHandler);
  }

  async rebindRetryLineage(classificationId, metadata) {
    return _rebindRetryLineage(classificationId, metadata);
  }
}

export const classificationPersistenceService = new ClassificationPersistenceService();

export { buildRagLoopSummary } from './classificationPersistenceServiceShared.mjs';
