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

function normalizeSqlState(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^(?=.*\d)[A-Z0-9]{5}$/.test(normalized) ? normalized : null;
}

export async function persistRagLoopStageEvents({ classificationId, result = {} } = {}, ragErrorHandler) {
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
      // This compatibility normalization happens before any persistence or
      // logging boundary. It may inspect a legacy in-memory error only to
      // select a fixed reason identifier; it never forwards the error itself.
      const stageEventError = rawEvent.error_message
        ? {
          message: rawEvent.error_message,
          name: rawEvent.error_name || 'Error',
          code: rawEvent.error_code || rawEvent.sql_state || rawEvent.sqlState || null,
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
      let resolvedReasonCode = mappedError.reasonCode;
      const normalizedResolvedReason = typeof resolvedReasonCode === 'string'
        ? resolvedReasonCode.trim().toLowerCase()
        : '';
      if (
        stageEventError &&
        (normalizedResolvedReason === 'rag_pass1_candidate_failed' || normalizedResolvedReason === 'rag_pass2_failed')
      ) {
        const refinedMappedError = mapSecondPassError({
          stage,
          fallbackReasonCode: normalizedResolvedReason,
          error: stageEventError,
        });
        if (refinedMappedError?.reasonCode && refinedMappedError.reasonCode !== normalizedResolvedReason) {
          resolvedReasonCode = refinedMappedError.reasonCode;
        }
      }
      const resolvedSqlState = normalizeSqlState(rawEvent.sql_state || rawEvent.sqlState) || mappedError.sqlState || null;
      const resolvedOutcome = rawEvent.outcome || null;
      const resolvedRecoverable = rawEvent.recoverable === false ? false : mappedError.recoverable;
      const rawDurationMs = rawEvent.duration_ms ?? rawEvent.durationMs;
      const eventDurationMs = Number.isFinite(Number(rawDurationMs))
        ? Math.max(0, Math.round(Number(rawDurationMs)))
        : null;
      const logResult = await ragLogger.logStageEvent({
        classification_id: classificationId,
        stage,
        outcome: resolvedOutcome,
        reason_code: resolvedReasonCode,
        fallback_action: rawEvent.fallback_action || rawEvent.fallbackAction || null,
        recoverable: resolvedRecoverable,
        sql_state: resolvedSqlState,
        correlation_id: correlationId,
        rollout_mode: rolloutMode,
        strategy,
        trigger,
        duration_ms: eventDurationMs,
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
              duration_ms: eventDurationMs,
            },
          });
        }
      }
    }
  } catch {
    logger.warn('Failed to persist rag loop stage logs', {
      classificationId,
      reasonCode: 'rag_stage_log_persist_failed',
    });
  }
}
