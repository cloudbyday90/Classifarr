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
import db from '../config/database.mjs';
import ragRetriever from './ragRetriever.mjs';
import policyEngine from './policyEngine.mjs';
import ragLoopMetricsCollector from './ragLoopMetricsCollector.mjs';
import ragLoopResilienceManager from './ragLoopResilienceManager.mjs';
import { aiClassify } from './classificationAiService.mjs';
import {
  enrichWithTMDB,
  mergeMetadataForRecheck,
} from './classificationMetadataService.mjs';
import {
  resolveAiFailureClassification,
  resolveRagLoopTimeout,
  sleep,
  withRetryableDbConflict,
  withTimeout,
} from './classificationUtilsService.mjs';
import ragLogger from '../utils/ragLogger.mjs';
import ragLoopConfig from '../utils/ragLoopConfig.mjs';
import ragLoopHelpers from '../utils/ragLoopHelpers.mjs';
import ragErrorHandler from '../utils/ragErrorHandler.mjs';
import loggerModule from '../utils/logger.mjs';
import {
  APP_VERSION,
  buildAiRerunCandidate as buildAiRerunCandidateHelper,
  buildAiRerunFailureEvent as buildAiRerunFailureEventHelper,
  buildAutoFallbackIncidentPayload as buildAutoFallbackIncidentPayloadHelper,
  buildFreshSecondPassBaseResult as buildFreshSecondPassBaseResultHelper,
  buildPolicyRecheckCandidate as buildPolicyRecheckCandidateHelper,
  getCurrentAppVersion as resolveCurrentAppVersion,
  getCurrentImageTag as resolveCurrentImageTag,
} from './classificationRagLoopServiceShared.mjs';
import { createResolvedLoader, loadResolvedDependency } from './shared/resolvedLoader.mjs';

const { validateAndNormalizeRagLoopConfig } = ragLoopConfig;
const {
  RAG_LOOP_FALLBACK_ACTIONS,
  RAG_LOOP_REASON_CODES,
  applyOrShadowDecision,
  buildRagLoopTrace,
  comparePassResults,
  detectRagConflict,
  evaluatePolicyRecheckGate,
  expandRetrievalMetadata,
  extractVerifiableEvidence,
  getRecheckEligibility,
  getMetadataCompleteness,
  isAiRerunEligible,
  isLearningEligible,
  isMetadataEnrichmentEligible,
  resolvePolicyContextOrFallback,
  resolveConflictDecision,
  selectRetryStrategy,
  shouldTriggerSecondPass,
  summarizePassDiagnostics,
} = ragLoopHelpers;
const { createLogger } = loggerModule;

const logger = createLogger('classificationRagLoop');

class ClassificationRagLoopService {
  constructor() {
    this.loadRagErrorHandler = createResolvedLoader(ragErrorHandler);
  }

  async getRagErrorHandler() {
    return loadResolvedDependency(this.loadRagErrorHandler);
  }

  async getRagLoopConfig() {
    try {
      const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
      const row = result.rows[0] || {};
      const normalized = validateAndNormalizeRagLoopConfig(row).normalizedConfig;
      return {
        ...normalized,
        rag_loop_auto_fallback_breach_count: Math.max(0, Number(row.rag_loop_auto_fallback_breach_count || 0)),
        rag_loop_auto_fallback_last_breach_at: row.rag_loop_auto_fallback_last_breach_at || null,
        rag_loop_auto_fallback_last_triggered_at: row.rag_loop_auto_fallback_last_triggered_at || null,
        rag_loop_auto_fallback_cooldown_until: row.rag_loop_auto_fallback_cooldown_until || null,
        rag_loop_auto_fallback_last_incident_id: row.rag_loop_auto_fallback_last_incident_id || null,
        rag_loop_auto_fallback_last_incident_payload: row.rag_loop_auto_fallback_last_incident_payload || null,
        rag_loop_auto_fallback_last_version: row.rag_loop_auto_fallback_last_version || null,
        rag_loop_auto_recover_last_attempt_version: row.rag_loop_auto_recover_last_attempt_version || null,
        rag_loop_auto_recover_last_attempt_at: row.rag_loop_auto_recover_last_attempt_at || null,
      };
    } catch (error) {
      logger.warn('Failed to load rag loop config, using defaults', { error: error.message });
      return {
        ...validateAndNormalizeRagLoopConfig({}).normalizedConfig,
        rag_loop_auto_fallback_breach_count: 0,
        rag_loop_auto_fallback_last_breach_at: null,
        rag_loop_auto_fallback_last_triggered_at: null,
        rag_loop_auto_fallback_cooldown_until: null,
        rag_loop_auto_fallback_last_incident_id: null,
        rag_loop_auto_fallback_last_incident_payload: null,
        rag_loop_auto_fallback_last_version: null,
        rag_loop_auto_recover_last_attempt_version: null,
        rag_loop_auto_recover_last_attempt_at: null,
      };
    }
  }

  getCurrentAppVersion() {
    return resolveCurrentAppVersion(APP_VERSION);
  }

  getCurrentImageTag() {
    return resolveCurrentImageTag();
  }

  async getRecentFallbackDiagnostics(limit = 20) {
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

  buildAutoFallbackIncidentPayload(params) {
    return buildAutoFallbackIncidentPayloadHelper(params);
  }

  async persistAutoFallbackBreachCount({ nextBreachCount, breachDetected }) {
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

  async maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded = false }) {
    const state = {
      breachCount: Number(config.rag_loop_auto_fallback_breach_count || 0),
      cooldownUntil: config.rag_loop_auto_fallback_cooldown_until,
      lastFallbackVersion: config.rag_loop_auto_fallback_last_version,
      lastRecoverAttemptVersion: config.rag_loop_auto_recover_last_attempt_version,
    };

    const currentVersion = this.getCurrentAppVersion();
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
      await this.persistAutoFallbackBreachCount({
        nextBreachCount: evaluation.nextBreachCount,
        breachDetected: evaluation.breachDetected,
      });
    }

    if (!evaluation.shouldFallback) {
      return;
    }

    const incidentId = randomUUID();
    const triggeredAt = new Date().toISOString();
    const imageTag = this.getCurrentImageTag();
    const diagnostics = await this.getRecentFallbackDiagnostics(50);
    const incidentPayload = this.buildAutoFallbackIncidentPayload({
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

  buildFreshSecondPassBaseResult(baselineResult = {}) {
    return buildFreshSecondPassBaseResultHelper(baselineResult);
  }

  buildPolicyRecheckCandidate(params) {
    return buildPolicyRecheckCandidateHelper(params);
  }

  buildAiRerunCandidate(params) {
    return buildAiRerunCandidateHelper(params);
  }

  buildAiRerunFailureEvent(params) {
    return buildAiRerunFailureEventHelper(params);
  }

  async enrichWithTMDB(tmdbId, mediaType) {
    return enrichWithTMDB(tmdbId, mediaType);
  }

  mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
    return mergeMetadataForRecheck(originalMetadata, enrichedMetadata);
  }

  async evaluateRagLoopSecondPass({ metadata, libraries, baselineResult, policyResult = null, signalContext = null, ragContext = null }) {
    const { mapSecondPassError } = await this.getRagErrorHandler();
    const config = await this.getRagLoopConfig();
    const rolloutMode = config.rag_loop_rollout_mode || 'shadow';
    const correlationId = randomUUID();
    const traceConfig = { maxEvents: config.rag_loop_trace_max_events, maxBytes: config.rag_loop_trace_max_bytes };
    const policyContext = resolvePolicyContextOrFallback({ policyResult });
    const trigger = shouldTriggerSecondPass({ config, policyResult, aiResult: baselineResult, signalContext });

    if (!config.rag_retrieval_loop_enabled) {
      return baselineResult;
    }

    const loopStart = Date.now();
    const loopTimeoutMs = resolveRagLoopTimeout(config);
    const events = [];
    let pass1Diagnostics = {};
    let pass2Diagnostics = {};
    const topN = Math.max(1, Number(config.rag_conflict_top_n || 5));
    const candidateLimit = Math.max(1, Number(config.rag_loop_candidate_limit || 25));
    const expansionOptions = {
      identifierCaps: config.policy_recheck_identifier_caps,
      aliasEnabled: config.rag_alias_expansion_enabled,
      aliasMaxTerms: config.rag_alias_max_terms,
      aliasMinTokenLength: config.rag_alias_min_token_length,
    };
    const addEvent = ({ stage, outcome, reason, reasonCode, fallbackAction = null, recoverable = true, sqlState = null, error = null }) => {
      const errorDetails = error ? {
        error_message: error.message || String(error),
        error_name: error.name || 'Error',
        error_stack: error.stack || null,
        error_code: error.code || null,
      } : {};
      events.push({
        stage,
        outcome,
        reason: reason || reasonCode || (error ? error.message : null) || null,
        reason_code: reasonCode || null,
        fallback_action: fallbackAction,
        recoverable,
        sql_state: sqlState,
        ...errorDetails,
      });
    };
    const classifyStageError = async (stage, error, fallbackReasonCode) => {
      const mapped = mapSecondPassError({ stage, fallbackReasonCode, error });
      const message = typeof error?.message === 'string' ? error.message.trim() : '';
      const messageCode = /^[a-z0-9_]+$/i.test(message) ? message : null;
      return {
        reasonCode: mapped.reasonCode || messageCode || fallbackReasonCode,
        sqlState: mapped.sqlState,
        recoverable: mapped.recoverable,
      };
    };
    const remainingBudget = () => Math.max(0, loopTimeoutMs - (Date.now() - loopStart));
    const canRetryStage = ({ stageError, attempt, maxAttempts }) => Boolean(stageError && stageError.recoverable !== false && attempt < maxAttempts && remainingBudget() > 0);
    const retrievalRetryBaseDelayMs = Math.max(10, Number(config.rag_loop_retry_backoff_ms || 75));
    const withRagLoopLogContext = (finalResult, strategy = null) => ({
      ...finalResult,
      ragLoopLogContext: {
        correlationId,
        mode: rolloutMode,
        strategy: strategy || null,
        trigger: trigger.trigger || null,
        events: events.map((event) => ({ ...event })),
      },
    });
    let hadError = false;
    const buildTraceSafely = ({ ran, strategy = null, comparison = null, resolution = null, learning = null, timing = {} } = {}) => {
      if (!config.rag_loop_trace_enabled) {
        return null;
      }
      try {
        return buildRagLoopTrace({ mode: rolloutMode, ran, trigger: trigger.trigger, strategy, events, pass1Diagnostics, pass2Diagnostics, comparison, resolution, learning, timing, traceConfig });
      } catch (error) {
        hadError = true;
        addEvent({ stage: 'trace', outcome: 'error', reason: error.message, reasonCode: 'trace_build_failed', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.TRACE_OMITTED });
        logger.warn('Failed to build rag loop trace', { correlationId, stage: 'trace', reason_code: 'trace_build_failed', fallback_action: RAG_LOOP_FALLBACK_ACTIONS.TRACE_OMITTED, error: error.message });
        return null;
      }
    };

    if (!trigger.run) {
      const noRunReasonCode = trigger.reason === 'feature_disabled'
        ? RAG_LOOP_REASON_CODES.FEATURE_DISABLED
        : (trigger.reason === RAG_LOOP_REASON_CODES.MAX_PASSES_REACHED
          ? RAG_LOOP_REASON_CODES.MAX_PASSES_REACHED
          : (trigger.reason === RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR
            ? RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR
            : (policyContext.hasPolicyContext ? RAG_LOOP_REASON_CODES.GATE_NOT_MET : RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING)));
      addEvent({ stage: 'gate', outcome: 'skipped', reason: trigger.reason, reasonCode: noRunReasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED });
      const trace = buildTraceSafely({ ran: false });
      const decision = applyOrShadowDecision({ baselineResult, resolvedResult: baselineResult, comparison: { adopt: false, reason: trigger.reason }, rolloutMode, trace: config.rag_loop_trace_enabled ? trace : null });
      await this.maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded: false });
      return withRagLoopLogContext(decision.finalResult);
    }

    let aiCallsUsed = 1;
    const recheckEligibility = getRecheckEligibility({ trigger: trigger.trigger, policyContext, policyResult, identifierCaps: config.policy_recheck_identifier_caps }, metadata, config);
    if (trigger.trigger === 'policy_prompt_select' && !recheckEligibility.eligible) {
      addEvent({ stage: 'gate', outcome: 'skipped', reason: recheckEligibility.reasonCode, reasonCode: recheckEligibility.reasonCode, fallbackAction: recheckEligibility.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
      const trace = buildTraceSafely({ ran: true });
      const decision = applyOrShadowDecision({ baselineResult, resolvedResult: baselineResult, comparison: { adopt: false, reason: recheckEligibility.reasonCode }, rolloutMode, trace });
      ragLoopMetricsCollector.recordEvaluation({ rolloutMode: decision.mode, wouldUpgrade: decision.wouldAdopt, adopted: decision.adopted, hadError, latencyDeltaMs: (Date.now() - loopStart) - Number(baselineResult?.signalContext?.processingTimeMs || 0) });
      await this.maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded: true });
      return withRagLoopLogContext(decision.finalResult);
    }

    let pass1Candidates = [];
    const pass1MaxAttempts = Math.max(1, Number(config.rag_loop_pass1_max_attempts || 2));
    for (let attempt = 1; attempt <= pass1MaxAttempts; attempt += 1) {
      try {
        pass1Candidates = await withTimeout((signal) => ragRetriever.semanticSearchCandidates(metadata, candidateLimit, { pass: 'pass1', throwOnError: true, signal }), Math.max(1, remainingBudget()), 'rag_pass1_candidate_timeout');
        break;
      } catch (error) {
        const stageError = await classifyStageError('gate', error, 'rag_pass1_candidate_failed');
        if (canRetryStage({ stageError, attempt, maxAttempts: pass1MaxAttempts })) {
          addEvent({ stage: 'gate', outcome: 'retry', reason: `retry_${attempt}_of_${pass1MaxAttempts}`, reasonCode: stageError.reasonCode, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
          const delayMs = Math.min(500, retrievalRetryBaseDelayMs * Math.pow(2, attempt - 1));
          await sleep(Math.min(delayMs, remainingBudget()));
          continue;
        }
        hadError = true;
        addEvent({ stage: 'gate', outcome: 'error', reason: error.message, reasonCode: stageError.reasonCode, recoverable: stageError.recoverable, sqlState: stageError.sqlState, error });
        pass1Candidates = [];
        break;
      }
    }

    const pass1Conflict = config.rag_loop_conflict_detection_enabled ? detectRagConflict(pass1Candidates, config) : { isConflict: false, reason: 'conflict_detection_disabled' };
    const pass1Matches = Array.isArray(ragContext?.similarItems) && ragContext.similarItems.length > 0 ? ragContext.similarItems : pass1Candidates.slice(0, topN);
    pass1Diagnostics = summarizePassDiagnostics(pass1Matches, pass1Conflict, topN);
    const metadataCompleteness = getMetadataCompleteness(metadata, config);
    const strategySelection = selectRetryStrategy(pass1Diagnostics, metadataCompleteness, config);
    addEvent({ stage: 'gate', outcome: 'run', reason: trigger.trigger, reasonCode: trigger.trigger || RAG_LOOP_REASON_CODES.GATE_NOT_MET });
    addEvent({ stage: 'gate', outcome: 'strategy_selected', reason: strategySelection.reason, reasonCode: strategySelection.reason });

    let workingMetadata = { ...metadata };
    let enrichmentAttempts = 0;
    let enrichmentGate = isMetadataEnrichmentEligible({ trigger: trigger.trigger, metadata: workingMetadata, metadataCompleteness, config, attempts: enrichmentAttempts });
    if (enrichmentGate.eligible && remainingBudget() > 0) {
      const resilienceGate = ragLoopResilienceManager.canRun('tmdb_enrichment', config);
      if (!resilienceGate.allowed) {
        addEvent({ stage: 'enrichment', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED });
      } else {
        const enrichmentMaxAttempts = Math.max(0, Number(config.policy_recheck_metadata_max_attempts ?? 1));
        if (enrichmentMaxAttempts <= 0) {
          addEvent({
            stage: 'enrichment',
            outcome: 'skipped',
            reason: 'attempt_cap_reached',
            reasonCode: 'attempt_cap_reached',
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED,
          });
        }
        let enrichmentFinalError = null;
        let enrichmentFinalStageError = null;
        for (let attempt = 1; attempt <= enrichmentMaxAttempts; attempt += 1) {
          try {
            const timeoutMs = Math.min(Number(config.policy_recheck_metadata_timeout_ms || 2000), Math.max(1, remainingBudget()));
            const enrichedMetadata = await withTimeout(this.enrichWithTMDB(workingMetadata.tmdb_id, workingMetadata.media_type), timeoutMs, 'metadata_enrichment_timeout');
            enrichmentAttempts = attempt;
            workingMetadata = this.mergeMetadataForRecheck(workingMetadata, enrichedMetadata);
            enrichmentFinalError = null;
            enrichmentFinalStageError = null;
            break;
          } catch (error) {
            enrichmentAttempts = attempt;
            const stageError = await classifyStageError('enrichment', error, 'metadata_enrichment_failed');
            enrichmentFinalError = error;
            enrichmentFinalStageError = stageError;
            enrichmentGate = isMetadataEnrichmentEligible({ trigger: trigger.trigger, metadata: workingMetadata, metadataCompleteness, config, attempts: enrichmentAttempts });
            if (enrichmentGate.eligible && canRetryStage({ stageError, attempt, maxAttempts: enrichmentMaxAttempts })) {
              addEvent({ stage: 'enrichment', outcome: 'retry', reason: `retry_${attempt}_of_${enrichmentMaxAttempts}`, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
              const delayMs = Math.min(500, retrievalRetryBaseDelayMs * Math.pow(2, attempt - 1));
              await sleep(Math.min(delayMs, remainingBudget()));
              continue;
            }
            break;
          }
        }
        if (!enrichmentFinalError) {
          ragLoopResilienceManager.recordSuccess('tmdb_enrichment', config);
          addEvent({ stage: 'enrichment', outcome: 'applied', reason: 'metadata_updated', reasonCode: 'metadata_updated' });
        } else {
          hadError = true;
          ragLoopResilienceManager.recordFailure('tmdb_enrichment', enrichmentFinalError, config);
          const stageError = enrichmentFinalStageError || await classifyStageError('enrichment', enrichmentFinalError, 'metadata_enrichment_failed');
          addEvent({ stage: 'enrichment', outcome: 'skipped', reason: enrichmentFinalError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState, error: enrichmentFinalError });
        }
      }
    } else {
      addEvent({ stage: 'enrichment', outcome: 'skipped', reason: enrichmentGate.reason, reasonCode: enrichmentGate.reason, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED });
    }

    const expandedMetadata = expandRetrievalMetadata(workingMetadata, { pass: 'pass2', ...expansionOptions });
    let pass2Matches = [];
    let pass2Enabled = false;
    if (remainingBudget() > 0) {
      const resilienceGate = ragLoopResilienceManager.canRun('rag_pass2', config);
      if (!resilienceGate.allowed) {
        addEvent({ stage: 'retrieval_pass2', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED });
      } else {
        pass2Enabled = true;
        const pass2MaxAttempts = Math.max(1, Number(config.rag_loop_pass2_max_attempts || 2));
        let pass2FinalError = null;
        let pass2FinalStageError = null;
        const limit = Math.max(topN, 5);
        for (let attempt = 1; attempt <= pass2MaxAttempts; attempt += 1) {
          try {
            if (strategySelection.strategy === 'semantic') {
              pass2Matches = await withTimeout((signal) => ragRetriever.semanticSearch(expandedMetadata, limit, { pass: 'pass2', applyThreshold: false, useExpandedQuery: true, throwOnError: true, expansionOptions, signal }), Math.max(1, remainingBudget()), 'rag_pass2_semantic_timeout');
            } else {
              pass2Matches = await withTimeout((signal) => ragRetriever.hybridSearch(expandedMetadata, limit, { pass: 'pass2', applyThreshold: false, useExpandedQuery: true, throwOnError: true, expansionOptions, signal }), Math.max(1, remainingBudget()), 'rag_pass2_hybrid_timeout');
            }
            pass2FinalError = null;
            pass2FinalStageError = null;
            break;
          } catch (error) {
            const stageError = await classifyStageError('retrieval_pass2', error, 'rag_pass2_failed');
            pass2FinalError = error;
            pass2FinalStageError = stageError;
            if (canRetryStage({ stageError, attempt, maxAttempts: pass2MaxAttempts })) {
              addEvent({ stage: 'retrieval_pass2', outcome: 'retry', reason: `retry_${attempt}_of_${pass2MaxAttempts}`, reasonCode: stageError.reasonCode, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
              const delayMs = Math.min(500, retrievalRetryBaseDelayMs * Math.pow(2, attempt - 1));
              await sleep(Math.min(delayMs, remainingBudget()));
              continue;
            }
            pass2Matches = [];
            break;
          }
        }
        if (!pass2FinalError) {
          ragLoopResilienceManager.recordSuccess('rag_pass2', config);
          addEvent({ stage: 'retrieval_pass2', outcome: 'applied', reason: strategySelection.strategy, reasonCode: strategySelection.strategy });
        } else {
          hadError = true;
          ragLoopResilienceManager.recordFailure('rag_pass2', pass2FinalError, config);
          const stageError = pass2FinalStageError || await classifyStageError('retrieval_pass2', pass2FinalError, 'rag_pass2_failed');
          addEvent({ stage: 'retrieval_pass2', outcome: 'error', reason: pass2FinalError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState, error: pass2FinalError });
          pass2Matches = [];
        }
      }
    } else {
      addEvent({ stage: 'retrieval_pass2', outcome: 'skipped', reason: 'loop_budget_exhausted', reasonCode: 'loop_budget_exhausted', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED });
    }

    let pass2Candidates = [];
    if (pass2Enabled && remainingBudget() > 0) {
      const pass2CandidateMaxAttempts = Math.max(1, Number(config.rag_loop_pass2_candidate_max_attempts || 2));
      let pass2CandidateError = null;
      let pass2CandidateStageError = null;
      for (let attempt = 1; attempt <= pass2CandidateMaxAttempts; attempt += 1) {
        try {
          pass2Candidates = await withTimeout((signal) => ragRetriever.semanticSearchCandidates(expandedMetadata, candidateLimit, { pass: 'pass2', useExpandedQuery: true, throwOnError: true, expansionOptions, signal }), Math.max(1, remainingBudget()), 'rag_pass2_candidate_timeout');
          pass2CandidateError = null;
          pass2CandidateStageError = null;
          break;
        } catch (error) {
          const stageError = await classifyStageError('retrieval_pass2', error, 'rag_pass2_failed');
          pass2CandidateError = error;
          pass2CandidateStageError = stageError;
          if (canRetryStage({ stageError, attempt, maxAttempts: pass2CandidateMaxAttempts })) {
            addEvent({ stage: 'retrieval_pass2', outcome: 'retry', reason: `retry_${attempt}_of_${pass2CandidateMaxAttempts}`, reasonCode: stageError.reasonCode, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
            const delayMs = Math.min(500, retrievalRetryBaseDelayMs * Math.pow(2, attempt - 1));
            await sleep(Math.min(delayMs, remainingBudget()));
            continue;
          }
          pass2Candidates = [];
          break;
        }
      }
      if (pass2CandidateError) {
        hadError = true;
        ragLoopResilienceManager.recordFailure('rag_pass2', pass2CandidateError, config);
        const stageError = pass2CandidateStageError || await classifyStageError('retrieval_pass2', pass2CandidateError, 'rag_pass2_failed');
        addEvent({ stage: 'retrieval_pass2', outcome: 'error', reason: pass2CandidateError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState, error: pass2CandidateError });
      }
    }
    const pass2EvidenceMatches = pass2Candidates.length > 0 ? pass2Candidates.slice(0, topN) : (pass2Matches && pass2Matches.length > 0 ? pass2Matches.slice(0, topN) : []);
    const pass2Conflict = config.rag_loop_conflict_detection_enabled ? detectRagConflict(pass2EvidenceMatches, config) : { isConflict: false, reason: 'conflict_detection_disabled' };
    pass2Diagnostics = summarizePassDiagnostics(pass2EvidenceMatches, pass2Conflict, topN);
    const pass2RagContext = pass2EvidenceMatches.length > 0 ? { similarItems: pass2EvidenceMatches.slice(0, 3), suggestion: ragRetriever.getSuggestedLibrary(pass2EvidenceMatches) } : ragContext;
    let policyAfter = policyResult;
    let policyGate = { shouldAdopt: false, actionUpgraded: false, measurableImprovement: false, reason: 'policy_not_run', metrics: {} };
    let pass2Candidate = null;

    if ((trigger.trigger === 'policy_prompt_select' || trigger.trigger === 'policy_prompt_confirm') && remainingBudget() > 0) {
      const evidence = extractVerifiableEvidence(expandedMetadata, config.policy_recheck_identifier_caps);
      const policyRecheckMaxAttempts = Math.max(0, Number(config.policy_recheck_max_attempts ?? 1));
      if (policyRecheckMaxAttempts <= 0) {
        addEvent({ stage: 'policy_recheck', outcome: 'skipped', reason: 'attempt_cap_reached', reasonCode: 'attempt_cap_reached', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
      } else if (evidence.totalTokens > 0 || pass2EvidenceMatches.length > 0) {
        let policyRecheckError = null;
        let policyRecheckStageError = null;
        for (let attempt = 1; attempt <= policyRecheckMaxAttempts; attempt += 1) {
          try {
            policyAfter = await withRetryableDbConflict(
              () => withTimeout(
                policyEngine.evaluateItem(expandedMetadata, { ragCache: { matches: pass2EvidenceMatches.slice(0, 5), timestamp: Date.now() } }),
                Math.max(1, remainingBudget()),
                'policy_recheck_timeout',
              ),
              {
                maxAttempts: 2,
                baseDelayMs: retrievalRetryBaseDelayMs,
                onRetry: ({ attempt, maxAttempts, sqlState, reasonCode }) => {
                  addEvent({
                    stage: 'policy_recheck',
                    outcome: 'retry',
                    reason: `retry_${attempt}_of_${maxAttempts}`,
                    reasonCode,
                    fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
                    recoverable: true,
                    sqlState,
                  });
                },
              },
            );
            policyRecheckError = null;
            policyRecheckStageError = null;
            break;
          } catch (error) {
            const stageError = await classifyStageError('policy_recheck', error, 'policy_recheck_failed');
            policyRecheckError = error;
            policyRecheckStageError = stageError;
            if (canRetryStage({ stageError, attempt, maxAttempts: policyRecheckMaxAttempts })) {
              addEvent({ stage: 'policy_recheck', outcome: 'retry', reason: `retry_${attempt}_of_${policyRecheckMaxAttempts}`, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
              const delayMs = Math.min(500, retrievalRetryBaseDelayMs * Math.pow(2, attempt - 1));
              await sleep(Math.min(delayMs, remainingBudget()));
              continue;
            }
            break;
          }
        }
        if (!policyRecheckError) {
          policyGate = evaluatePolicyRecheckGate({ policyBefore: policyResult, policyAfter, pass1Diagnostics, pass2Diagnostics, config });
          addEvent({ stage: 'policy_recheck', outcome: policyGate.shouldAdopt ? 'accepted' : 'evaluated', reason: policyGate.reason, reasonCode: policyGate.reason, fallbackAction: policyGate.shouldAdopt ? null : RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
          if (policyGate.shouldAdopt) {
            pass2Candidate = this.buildPolicyRecheckCandidate({ baselineResult, libraries, policyResult: policyAfter, ragContext: pass2RagContext, adoptionReason: 'Policy re-check upgraded confidence' });
          }
        } else {
          hadError = true;
          const stageError = policyRecheckStageError || await classifyStageError('policy_recheck', policyRecheckError, 'policy_recheck_failed');
          addEvent({ stage: 'policy_recheck', outcome: 'error', reason: policyRecheckError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
        }
      } else {
        addEvent({ stage: 'policy_recheck', outcome: 'skipped', reason: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE, reasonCode: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
      }
    }

    if (!pass2Candidate) {
      const resilienceGate = ragLoopResilienceManager.canRun('ai_rerun', config);
      if (!resilienceGate.allowed) {
        addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
      } else {
        const aiRerunGate = isAiRerunEligible({ trigger: trigger.trigger, aiCallsUsed, config, pass1Diagnostics, pass2Diagnostics, policyAfter });
        if (aiRerunGate.eligible) {
          try {
            aiCallsUsed += 1;
            const aiRerunMatch = await aiClassify(expandedMetadata, libraries, signalContext, { mode: 'verify', ragContext: pass2RagContext });
            pass2Candidate = this.buildAiRerunCandidate({ baselineResult, aiRerunMatch, libraries, signalContext, policyResult: policyAfter, ragContext: pass2RagContext });
            ragLoopResilienceManager.recordSuccess('ai_rerun', config);
            addEvent({ stage: 'ai_rerun', outcome: 'applied', reason: 'material_improvement', reasonCode: 'material_improvement' });
          } catch (error) {
            const aiFailure = resolveAiFailureClassification(error);
            const isTransientAiAvailability = aiFailure.isTransientAvailability;
            if (!isTransientAiAvailability) {
              hadError = true;
              ragLoopResilienceManager.recordFailure('ai_rerun', error, config);
            }
            const stageError = await classifyStageError('ai_rerun', error, 'ai_rerun_failed');
            addEvent(this.buildAiRerunFailureEvent({
              aiFailure,
              error,
              stageError,
              fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED,
            }));
          }
        } else {
          addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: aiRerunGate.reason, reasonCode: aiRerunGate.reason, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
        }
      }
    } else {
      addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: 'policy_candidate_selected', reasonCode: 'policy_candidate_selected', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
    }

    if (!pass2Candidate && pass2Matches && pass2Matches.length > 0 && pass2RagContext?.suggestion) {
      const ragSuggestion = pass2RagContext.suggestion;
      const ragLibrary = libraries.find((library) => library.name === ragSuggestion || library.id === ragSuggestion);
      if (ragLibrary) {
        const ragConfidence = Math.max(Number(baselineResult?.confidence || 0), Math.min(75, Number(pass2Diagnostics.topSimilarity || 0) * 100));
        pass2Candidate = { ...baselineResult, library: ragLibrary, confidence: ragConfidence, method: 'rag_improved', reason: 'Pass2 RAG retrieval found stronger matches', ragContext: pass2RagContext, policyResult: policyAfter || policyResult };
        addEvent({ stage: 'rag_candidate', outcome: 'applied', reason: 'rag_candidate_built', reasonCode: 'rag_candidate_built' });
      }
    }

    const comparison = comparePassResults({ baselineResult, pass2Result: pass2Candidate, policyGate, pass1Diagnostics, pass2Diagnostics, pass2Conflict, config });
    const resolution = resolveConflictDecision({ baselineResult, pass2Result: pass2Candidate, comparison, policyBefore: policyResult, policyAfter, pass2Conflict });
    const learning = isLearningEligible({ config, rolloutMode, secondPassApplied: comparison.adopt, userValidated: false, machineOnly: true });
    const trace = buildTraceSafely({ ran: true, strategy: strategySelection.strategy, comparison, resolution, learning, timing: { total: Date.now() - loopStart } });
    const decision = applyOrShadowDecision({ baselineResult, resolvedResult: resolution.resolvedResult, comparison, rolloutMode, trace });
    ragLoopMetricsCollector.recordEvaluation({ rolloutMode: decision.mode, wouldUpgrade: decision.wouldAdopt, adopted: decision.adopted, hadError, latencyDeltaMs: (Date.now() - loopStart) - Number(baselineResult?.signalContext?.processingTimeMs || 0) });
    await this.maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded: true });
    return withRagLoopLogContext(decision.finalResult, strategySelection.strategy);
  }
}

const classificationRagLoopService = new ClassificationRagLoopService();

export default classificationRagLoopService;
