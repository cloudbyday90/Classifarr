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
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as policyQuestionContext from '../utils/policyQuestionContext.mjs';
import * as ragErrorHandler from '../utils/ragErrorHandler.mjs';
import { buildRagLoopSummary } from './classificationPersistenceServiceShared.mjs';

const logger = createLogger('classificationPersistence');

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

  async persistRagLoopStageEvents({ classificationId, metadata = {}, result = {} } = {}) {
    try {
      const { mapSecondPassError } = await this.getRagErrorHandler();
      const logContext = result?.ragLoopLogContext || null;
      const events = Array.isArray(logContext?.events)
        ? logContext.events
        : (Array.isArray(result?.ragLoopTrace?.events) ? result.ragLoopTrace.events : []);

      if (!Array.isArray(events) || events.length === 0) {
        return;
      }

      const rolloutMode = logContext?.mode || result?.ragLoopTrace?.mode || null;
      const strategy = logContext?.strategy || result?.ragLoopTrace?.strategy || null;
      const trigger = logContext?.trigger || result?.ragLoopTrace?.trigger || null;
      const correlationId = logContext?.correlationId || null;
      const resolveStageMetricSpec = ({ stage, outcome, reasonCode }) => {
        const normalizedOutcome = typeof outcome === 'string' ? outcome.trim().toLowerCase() : '';
        if (stage === 'retrieval_pass2') {
          return {
            operation: 'second_pass_retrieval_pass2',
            success: normalizedOutcome === 'applied',
          };
        }

        if (stage === 'gate' && typeof reasonCode === 'string' && reasonCode.startsWith('rag_pass1_candidate_')) {
          return {
            operation: 'second_pass_gate_pass1',
            success: normalizedOutcome === 'applied',
          };
        }

        return null;
      };

      for (const rawEvent of events) {
        if (!rawEvent || typeof rawEvent !== 'object') {
          continue;
        }

        const sourceStage = typeof rawEvent.stage === 'string' ? rawEvent.stage : null;
        const stage = (sourceStage === 'strategy' || sourceStage === 'retrieval_pass1')
          ? 'gate'
          : sourceStage;
        const stageEventError = rawEvent.error_message
          ? {
            message: rawEvent.error_message,
            name: rawEvent.error_name || 'Error',
            code: rawEvent.error_code || rawEvent.sql_state || rawEvent.sqlState || null,
            stack: rawEvent.error_stack || null,
          }
          : ((rawEvent.sql_state || rawEvent.sqlState)
            ? { code: rawEvent.sql_state || rawEvent.sqlState }
            : null);
        const mappedError = mapSecondPassError({
          stage,
          reasonCode: rawEvent.reason_code || rawEvent.reason || null,
          fallbackReasonCode: rawEvent.reason || null,
          error: stageEventError,
        });
        let resolvedReasonCode = rawEvent.reason_code || rawEvent.reason || mappedError.reasonCode;
        const normalizedResolvedReason = typeof resolvedReasonCode === 'string'
          ? resolvedReasonCode.trim().toLowerCase()
          : '';
        if (
          stageEventError &&
          (normalizedResolvedReason === 'rag_pass1_candidate_failed' || normalizedResolvedReason === 'rag_pass2_failed')
        ) {
          const refinedMappedError = mapSecondPassError({
            stage,
            reasonCode: null,
            fallbackReasonCode: normalizedResolvedReason,
            error: stageEventError,
          });
          if (
            refinedMappedError?.reasonCode &&
            refinedMappedError.reasonCode !== normalizedResolvedReason
          ) {
            resolvedReasonCode = refinedMappedError.reasonCode;
          }
        }
        const resolvedSqlState = rawEvent.sql_state || rawEvent.sqlState || mappedError.sqlState || null;
        const resolvedOutcome = rawEvent.outcome || null;
        const resolvedRecoverable = rawEvent.recoverable === false ? false : mappedError.recoverable;
        const logResult = await ragLogger.logStageEvent({
          classification_id: classificationId,
          tmdb_id: metadata.tmdb_id || null,
          media_type: metadata.media_type || null,
          stage,
          outcome: resolvedOutcome,
          reason_code: resolvedReasonCode,
          fallback_action: rawEvent.fallback_action || rawEvent.fallbackAction || null,
          recoverable: resolvedRecoverable,
          sql_state: resolvedSqlState,
          error: stageEventError,
          correlation_id: correlationId,
          rollout_mode: rolloutMode,
          strategy,
          trigger,
          metadata: {
            tmdb_id: metadata.tmdb_id || null,
            media_type: metadata.media_type || null,
            title: metadata.title || null,
            source_stage: sourceStage,
            raw_reason: rawEvent.reason || null,
            raw_reason_code: rawEvent.reason_code || null,
            raw_error_message: rawEvent.error_message || null,
            raw_error_name: rawEvent.error_name || null,
            raw_error_code: rawEvent.error_code || null,
          },
        });

        if (logResult?.logged) {
          const metricSpec = resolveStageMetricSpec({
            stage,
            outcome: resolvedOutcome,
            reasonCode: resolvedReasonCode,
          });
          if (metricSpec) {
            const durationMs = Number.isFinite(Number(rawEvent.duration_ms || rawEvent.durationMs))
              ? Number(rawEvent.duration_ms || rawEvent.durationMs)
              : 0;
            await ragLogger.logOperation(metricSpec.operation, durationMs, metricSpec.success, {
              itemsProcessed: 1,
              metadata: {
                stage,
                outcome: resolvedOutcome,
                reason_code: resolvedReasonCode,
                recoverable: resolvedRecoverable,
                sql_state: resolvedSqlState,
                correlation_id: correlationId,
                classification_id: classificationId,
                rollout_mode: rolloutMode,
                strategy,
                trigger,
              },
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to persist rag loop stage logs', {
        classificationId,
        error: error.message,
      });
    }
  }

  async rebindRetryLineage(classificationId, metadata = {}) {
    const lineage = metadata.retry_lineage;
    if (!lineage || typeof lineage !== 'object') {
      return;
    }

    const normalizeIds = (ids) => (
      Array.isArray(ids)
        ? [...new Set(
          ids
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0),
        )]
        : []
    );

    const mediaRequestIds = normalizeIds(lineage.media_request_ids);
    const webhookLogIds = normalizeIds(lineage.webhook_log_ids);
    const originalClassificationId = Number.parseInt(lineage.original_classification_id, 10);

    if (
      mediaRequestIds.length === 0 &&
      webhookLogIds.length === 0 &&
      (!Number.isInteger(originalClassificationId) || originalClassificationId < 1)
    ) {
      return;
    }

    try {
      if (mediaRequestIds.length > 0) {
        await db.query(
          `UPDATE media_requests
           SET classification_id = $1
           WHERE id = ANY($2::int[])`,
          [classificationId, mediaRequestIds],
        );
      }

      if (webhookLogIds.length > 0) {
        await db.query(
          `UPDATE webhook_log
           SET classification_id = $1
           WHERE id = ANY($2::int[])`,
          [classificationId, webhookLogIds],
        );
      }

      if (Number.isInteger(originalClassificationId) && originalClassificationId > 0) {
        await classificationOutcomeService.recordOutcome(originalClassificationId, {
          replacement_classification_id: classificationId,
        });
      }
    } catch (error) {
      logger.error('Failed to rebind retry lineage', {
        classificationId,
        originalClassificationId,
        mediaRequestIds,
        webhookLogIds,
        error: error.message,
      });
    }
  }
}

export const classificationPersistenceService = new ClassificationPersistenceService();

export { buildRagLoopSummary } from './classificationPersistenceServiceShared.mjs';
