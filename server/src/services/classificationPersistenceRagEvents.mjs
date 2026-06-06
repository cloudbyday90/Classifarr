/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ragLogger } from '../utils/ragLogger.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationPersistence');

export async function persistRagLoopStageEvents({ classificationId, metadata = {}, result = {} } = {}, ragErrorHandler) {
  try {
    const { mapSecondPassError } = ragErrorHandler;
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
    const traceContext = result?.ragLoopTrace?.trace_context || result?.decisionTrace || null;
    const traceId = logContext?.traceId || traceContext?.trace_id || null;
    const spanId = logContext?.spanId || traceContext?.root_span_id || null;
    const traceparent = logContext?.traceparent || traceContext?.traceparent || null;
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
      const eventSpanId = rawEvent.span_id || rawEvent.spanId || spanId;
      const rawDurationMs = rawEvent.duration_ms ?? rawEvent.durationMs;
      const eventDurationMs = Number.isFinite(Number(rawDurationMs))
        ? Math.max(0, Math.round(Number(rawDurationMs)))
        : null;
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
          trace_id: traceId,
          span_id: eventSpanId,
          traceparent,
          duration_ms: eventDurationMs,
        },
      });

      if (logResult?.logged) {
        const metricSpec = resolveStageMetricSpec({
          stage,
          outcome: resolvedOutcome,
          reasonCode: resolvedReasonCode,
        });
        if (metricSpec) {
          const durationMs = eventDurationMs ?? 0;
          await ragLogger.logOperation(metricSpec.operation, durationMs, metricSpec.success, {
            itemsProcessed: 1,
            metadata: {
              stage,
              outcome: resolvedOutcome,
              reason_code: resolvedReasonCode,
              recoverable: resolvedRecoverable,
              sql_state: resolvedSqlState,
              correlation_id: correlationId,
              trace_id: traceId,
              span_id: eventSpanId,
              traceparent,
              duration_ms: eventDurationMs,
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
