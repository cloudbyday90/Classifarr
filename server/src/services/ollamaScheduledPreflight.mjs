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
import {
  buildAiRuntimeDedupeKey,
} from './aiEmbeddingProviderIntegrityService.mjs';
import {
  getConnectivityTimeoutMs,
  getProbeTimeoutMs,
  getScheduledPreflightRetryDelayMs,
  getScheduledWarnDedupeMs,
  classifyPreflightFailure,
} from './ollamaPreflightUtils.mjs';

const logger = createLogger('OllamaService');

export async function runScheduledPreflight(
  { enabled, baseIntervalMs, failureCount },
  { getConfig, preflightConnection, scheduleNext },
  trigger = 'scheduled',
) {
  if (!enabled) {
    return null;
  }

  try {
    try {
      const aiConfig = await db.query('SELECT primary_provider, ollama_fallback_enabled, embedding_provider_mode FROM ai_provider_config WHERE id = 1');
      const aiRow = aiConfig.rows[0];
      const primaryProvider = aiRow?.primary_provider || 'none';
      const fallbackEnabled = aiRow?.ollama_fallback_enabled || false;
      const embeddingMode = aiRow?.embedding_provider_mode || 'same';
      const ollamaNeeded = primaryProvider === 'ollama'
        || fallbackEnabled
        || embeddingMode === 'separate_ollama'
        || (embeddingMode === 'same' && primaryProvider === 'ollama');

      if (!ollamaNeeded) {
        const nextRun = scheduleNext(baseIntervalMs, 'scheduled');
        const result = {
          success: false,
          host: null,
          port: null,
          model: null,
          skipped: true,
          reason: 'ollama_not_configured',
          checkedAt: new Date().toISOString(),
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt,
          consecutiveFailures: 0,
        };
        logger.debug('Scheduled Ollama preflight skipped because Ollama is not the active provider');
        return { lastScheduledPreflight: result, lastEmbeddingPreflight: null, failureCount: 0 };
      }

      const config = await getConfig();
      if (!config.host) {
        const nextRun = scheduleNext(baseIntervalMs, 'scheduled');
        const result = {
          success: false,
          host: null,
          port: null,
          model: null,
          skipped: true,
          reason: 'host_not_configured',
          checkedAt: new Date().toISOString(),
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt,
          consecutiveFailures: 0,
        };
        logger.info('Scheduled Ollama preflight skipped because host is not configured', {
          nextScheduledAt: nextRun.nextScheduledAt,
        });
        return { lastScheduledPreflight: result, lastEmbeddingPreflight: null, failureCount: 0 };
      }

      let embeddingModel = null;
      try {
        const embedResult = await db.query('SELECT embedding_model, embedding_ollama_model FROM ai_provider_config WHERE id = 1');
        const row = embedResult.rows[0];
        embeddingModel = row?.embedding_model || row?.embedding_ollama_model || null;
      } catch (error) {
        logger.warn('Failed to load embedding model for scheduled Ollama preflight', {
          error: error.message,
        }, {
          dedupeKey: 'scheduled-embedding-model-query',
          dedupeWindowMs: getScheduledWarnDedupeMs(),
        });
      }

      const connectivityTimeoutMs = getConnectivityTimeoutMs();
      const probeTimeoutMs = getProbeTimeoutMs();

      const preflightResult = await preflightConnection({
        host: config.host,
        port: config.port,
        model: config.model,
        probeGeneration: true,
        force: true,
        includeModels: true,
        connectivityTimeoutMs,
        probeTimeoutMs,
      });

      if (preflightResult.success) {
        const recoveredFailures = failureCount;
        let newFailureCount = 0;
        let lastEmbeddingPreflight = null;

        if (embeddingModel && embeddingModel !== config.model) {
          const embedResult = await preflightConnection({
            host: config.host,
            port: config.port,
            model: embeddingModel,
            probeGeneration: false,
            force: true,
            includeModels: false,
            connectivityTimeoutMs,
          });
          lastEmbeddingPreflight = {
            ...embedResult,
            checkedAt: new Date().toISOString(),
            trigger,
          };
          if (embedResult.success) {
            logger.info('Scheduled Ollama embedding model preflight passed', {
              model: embeddingModel,
              available: true,
            });
          } else {
            logger.warn('Scheduled Ollama embedding model preflight failed', {
              host: embedResult.host,
              port: embedResult.port,
              model: embeddingModel,
              error: embedResult.error,
              errorCode: embedResult.errorCode,
              failureType: embedResult.failureType,
            }, {
              dedupeKey: `scheduled-embedding-preflight:${embedResult.host}:${embedResult.port}:${embeddingModel}:${embedResult.failureType || embedResult.errorCode || 'unknown'}`,
              dedupeWindowMs: getScheduledWarnDedupeMs(),
            });
          }
        }

        const nextRun = scheduleNext(baseIntervalMs, 'scheduled');
        const lastScheduledPreflight = {
          ...preflightResult,
          checkedAt: new Date().toISOString(),
          trigger,
          connectivityTimeoutMs,
          probeTimeoutMs,
          consecutiveFailures: 0,
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt,
        };

        if (recoveredFailures > 0) {
          logger.info('Scheduled Ollama preflight recovered', {
            host: preflightResult.host,
            port: preflightResult.port,
            model: config.model,
            modelCount: preflightResult.models?.length || 0,
            latencyMs: preflightResult.latency_ms,
            recoveredAfterFailures: recoveredFailures,
            nextScheduledAt: nextRun.nextScheduledAt,
          });
        } else {
          logger.info('Scheduled Ollama preflight passed', {
            host: preflightResult.host,
            port: preflightResult.port,
            model: config.model,
            modelCount: preflightResult.models?.length || 0,
            latencyMs: preflightResult.latency_ms,
            nextScheduledAt: nextRun.nextScheduledAt,
          });
        }

        return { lastScheduledPreflight, lastEmbeddingPreflight, failureCount: newFailureCount };
      } else {
        const newFailureCount = failureCount + 1;
        const retryDelayMs = getScheduledPreflightRetryDelayMs(newFailureCount);
        const nextRun = scheduleNext(retryDelayMs, 'retry');
        const lastScheduledPreflight = {
          ...preflightResult,
          checkedAt: new Date().toISOString(),
          trigger,
          connectivityTimeoutMs,
          probeTimeoutMs,
          consecutiveFailures: newFailureCount,
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt,
        };

        logger.warn('Scheduled Ollama preflight failed', {
          host: preflightResult.host,
          port: preflightResult.port,
          model: config.model,
          error: preflightResult.error,
          errorCode: preflightResult.errorCode,
          failureType: preflightResult.failureType,
          consecutiveFailures: newFailureCount,
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt,
        }, {
          dedupeKey: `scheduled-preflight:${preflightResult.host}:${preflightResult.port}:${config.model || 'none'}:${preflightResult.failureType || preflightResult.errorCode || 'unknown'}`,
          dedupeWindowMs: getScheduledWarnDedupeMs(),
        });

        return { lastScheduledPreflight, lastEmbeddingPreflight: null, failureCount: newFailureCount };
      }
    } catch (error) {
      const newFailureCount = failureCount + 1;
      const retryDelayMs = getScheduledPreflightRetryDelayMs(newFailureCount);
      const nextRun = scheduleNext(retryDelayMs, 'retry');
      const failureType = classifyPreflightFailure(error.code, error.message, 'scheduled');
      const lastScheduledPreflight = {
        success: false,
        host: null,
        port: null,
        model: null,
        checkedAt: new Date().toISOString(),
        trigger,
        error: error.message,
        errorCode: error.code || 'EOLLAMA_SCHEDULED_PREFLIGHT',
        failureType,
        consecutiveFailures: newFailureCount,
        nextAttemptInMs: nextRun.delayMs,
        nextScheduledAt: nextRun.nextScheduledAt,
      };

      logger.error('Scheduled Ollama preflight error', {
        error: error.message,
        errorCode: error.code || null,
        failureType,
        consecutiveFailures: newFailureCount,
        nextAttemptInMs: nextRun.delayMs,
        nextScheduledAt: nextRun.nextScheduledAt,
      }, {
        error,
        dedupeKey: buildAiRuntimeDedupeKey(
          'scheduled_preflight_error',
          `${failureType || error.code || 'unknown'}:${error.message || 'unknown'}`,
        ),
        dedupeWindowMs: getScheduledWarnDedupeMs(),
      });

      return { lastScheduledPreflight, lastEmbeddingPreflight: null, failureCount: newFailureCount };
    }
  } catch (outerError) {
    return { lastScheduledPreflight: null, lastEmbeddingPreflight: null, failureCount };
  }
}
