/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

import { randomUUID } from 'node:crypto';
import { buildAutoFallbackIncidentPayload } from './classificationRagLoopServiceShared.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationRagLoop');

export async function getRecentFallbackDiagnostics({ db, limit = 20 }) {
  try {
    const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const result = await db.query(`
      SELECT reason_code, correlation_id
      FROM error_log
      WHERE module = 'RAG'
      ORDER BY created_at DESC
      LIMIT $1
    `, [boundedLimit]);

    const reasonCounts = {};
    const correlationIds = [];
    for (const row of result.rows || []) {
      if (row.reason_code) {
        reasonCounts[row.reason_code] = (reasonCounts[row.reason_code] || 0) + 1;
      }
      if (row.correlation_id && !correlationIds.includes(row.correlation_id)) {
        correlationIds.push(row.correlation_id);
      }
    }

    const topReasonCodes = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason_code, count]) => ({ reason_code, count }));

    return {
      topReasonCodes,
      recentCorrelationIds: correlationIds.slice(0, 10),
    };
  } catch (_error) {
    return {
      topReasonCodes: [],
      recentCorrelationIds: [],
    };
  }
}

export async function persistAutoFallbackBreachCount({ db, nextBreachCount, breachDetected }) {
  try {
    await db.query(`
      UPDATE ai_provider_config
      SET rag_loop_auto_fallback_breach_count = $1,
          rag_loop_auto_fallback_last_breach_at = CASE WHEN $2::boolean THEN NOW() ELSE rag_loop_auto_fallback_last_breach_at END,
          updated_at = NOW()
      WHERE id = 1
    `, [nextBreachCount, breachDetected === true]);
  } catch (error) {
    logger.warn('Failed to persist rag loop auto fallback breach count', { error: error.message });
  }
}

export async function maybeApplyRolloutAutomation({ db, config, decision, correlationId, sampleRecorded = false, getCurrentAppVersion, getCurrentImageTag, ragLoopMetricsCollector, ragLogger }) {
  const state = {
    breachCount: Number(config.rag_loop_auto_fallback_breach_count || 0),
    cooldownUntil: config.rag_loop_auto_fallback_cooldown_until,
    lastFallbackVersion: config.rag_loop_auto_fallback_last_version,
    lastRecoverAttemptVersion: config.rag_loop_auto_recover_last_attempt_version,
  };

  const currentVersion = getCurrentAppVersion();
  const autoRecoverEvaluation = ragLoopMetricsCollector.shouldAttemptAutoRecover({
    config,
    state,
    currentVersion,
    rolloutMode: decision.mode,
  });

  if (autoRecoverEvaluation.shouldRecover) {
    try {
      await db.query(`
        UPDATE ai_provider_config
        SET rag_loop_rollout_mode = 'apply',
            rag_loop_auto_fallback_breach_count = 0,
            rag_loop_auto_fallback_cooldown_until = NULL,
            rag_loop_auto_recover_last_attempt_version = $1,
            rag_loop_auto_recover_last_attempt_at = NOW(),
            updated_at = NOW()
        WHERE id = 1
      `, [currentVersion]);

      await ragLogger.logStageEvent({
        stage: 'gate',
        outcome: 'applied',
        reason_code: 'rollout_auto_recover_applied',
        recoverable: true,
        rollout_mode: 'shadow',
        metadata: {
          current_version: currentVersion,
          previous_fallback_version: state.lastFallbackVersion || null,
        },
        correlation_id: correlationId || null,
      });
    } catch (error) {
      logger.warn('Failed to auto-recover rag loop rollout mode', { error: error.message });
    }
    return;
  }

  if (decision.mode !== 'apply' || !sampleRecorded) {
    return;
  }

  const evaluation = ragLoopMetricsCollector.evaluateAutoFallback({ config, state });

  if (evaluation.shouldPersistBreachCount && !evaluation.shouldFallback) {
    await persistAutoFallbackBreachCount({
      db,
      nextBreachCount: evaluation.nextBreachCount,
      breachDetected: evaluation.breachDetected,
    });
  }

  if (!evaluation.shouldFallback) {
    return;
  }

  const incidentId = randomUUID();
  const triggeredAt = new Date().toISOString();
  const imageTag = getCurrentImageTag();
  const diagnostics = await getRecentFallbackDiagnostics({ db, limit: 50 });
  const incidentPayload = buildAutoFallbackIncidentPayload({
    incidentId,
    triggeredAt,
    evaluation,
    previousMode: 'apply',
    nextMode: 'shadow',
    currentVersion,
    imageTag,
    diagnostics,
    stateSnapshot: {
      autoFallbackEnabled: config.rag_loop_auto_fallback_enabled !== false,
      autoRecoverEnabled: config.rag_loop_auto_recover_enabled === true,
      cooldownUntil: config.rag_loop_auto_fallback_cooldown_until,
    },
  });

  try {
    await db.query(`
      UPDATE ai_provider_config
      SET rag_loop_rollout_mode = 'shadow',
          rag_loop_auto_fallback_breach_count = 0,
          rag_loop_auto_fallback_last_breach_at = NOW(),
          rag_loop_auto_fallback_last_triggered_at = NOW(),
          rag_loop_auto_fallback_cooldown_until = NOW() + make_interval(secs => ($1::numeric / 1000.0)),
          rag_loop_auto_fallback_last_incident_id = $2,
          rag_loop_auto_fallback_last_incident_payload = $3::jsonb,
          rag_loop_auto_fallback_last_version = $4,
          updated_at = NOW()
      WHERE id = 1
    `, [evaluation.thresholds.cooldown_ms, incidentId, JSON.stringify(incidentPayload), currentVersion]);

    await ragLogger.logStageEvent({
      stage: 'gate',
      outcome: 'error',
      reason_code: 'rollout_auto_fallback_triggered',
      fallback_action: 'mode_switched_shadow',
      recoverable: false,
      rollout_mode: 'apply',
      correlation_id: correlationId || null,
      metadata: {
        incident_id: incidentId,
        thresholds: evaluation.thresholds,
        observed_metrics: evaluation.observedMetrics,
        breach_reason_codes: evaluation.breachReasonCodes,
        app_version: currentVersion,
        image_tag: imageTag || null,
      },
    });
  } catch (error) {
    logger.warn('Failed to apply rag loop auto fallback transition', { error: error.message });
  }
}
