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
import * as db from '../config/database.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { ragLoopMetricsCollector } from './ragLoopMetricsCollector.mjs';
import { aiClassify } from './classificationAiService.mjs';
import {
  enrichWithTMDB,
  mergeMetadataForRecheck,
} from './classificationMetadataService.mjs';
import {
  resolveRagLoopTimeout,
  sleep,
  withTimeout,
} from './classificationUtilsService.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import {
  getRecentFallbackDiagnostics,
  maybeApplyRolloutAutomation,
  persistAutoFallbackBreachCount,
} from './classificationRagLoopRollout.mjs';
import { ragLoopHelpers } from '../utils/ragLoopHelpers.mjs';
import * as ragErrorHandler from '../utils/ragErrorHandler.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getRagLoopConfig as _getRagLoopConfig } from './classificationRagLoopConfig.mjs';
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
import {
  runEnrichmentPhase,
  runPass2RetrievalPhase,
  runPolicyRecheckPhase,
  runAiRerunPhase,
} from './classificationRagLoopPhases.mjs';

const {
  RAG_LOOP_FALLBACK_ACTIONS,
  RAG_LOOP_REASON_CODES,
  applyOrShadowDecision,
  buildRagLoopTrace,
  comparePassResults,
  getRecheckEligibility,
  getMetadataCompleteness,
  isLearningEligible,
  resolvePolicyContextOrFallback,
  resolveConflictDecision,
  selectRetryStrategy,
  shouldTriggerSecondPass,
  summarizePassDiagnostics,
} = ragLoopHelpers;

const logger = createLogger('classificationRagLoop');

class ClassificationRagLoopService {
  constructor(deps = {}) {
    this.ragErrorHandler = deps.ragErrorHandler || ragErrorHandler;
  }

  async getRagErrorHandler() {
    return this.ragErrorHandler;
  }

  async getRagLoopConfig() {
    return _getRagLoopConfig();
  }

  getCurrentAppVersion() {
    return resolveCurrentAppVersion(APP_VERSION);
  }

  getCurrentImageTag() {
    return resolveCurrentImageTag();
  }

  async getRecentFallbackDiagnostics(limit = 20) {
    return getRecentFallbackDiagnostics({ db, limit });
  }

  buildAutoFallbackIncidentPayload(params) {
    return buildAutoFallbackIncidentPayloadHelper(params);
  }

  async persistAutoFallbackBreachCount({ nextBreachCount, breachDetected }) {
    return persistAutoFallbackBreachCount({ db, nextBreachCount, breachDetected });
  }

  async maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded = false }) {
    return maybeApplyRolloutAutomation({ db, config, decision, correlationId, sampleRecorded, getCurrentAppVersion: () => this.getCurrentAppVersion(), getCurrentImageTag: () => this.getCurrentImageTag(), ragLoopMetricsCollector, ragLogger });
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

  async aiClassify(metadata, libraries, signalContext = null, options = {}) {
    return aiClassify(metadata, libraries, signalContext, options);
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

    const pass1Conflict = config.rag_loop_conflict_detection_enabled ? ragLoopHelpers.detectRagConflict(pass1Candidates, config) : { isConflict: false, reason: 'conflict_detection_disabled' };
    const pass1Matches = Array.isArray(ragContext?.similarItems) && ragContext.similarItems.length > 0 ? ragContext.similarItems : pass1Candidates.slice(0, topN);
    pass1Diagnostics = summarizePassDiagnostics(pass1Matches, pass1Conflict, topN);
    const metadataCompleteness = getMetadataCompleteness(metadata, config);
    const strategySelection = selectRetryStrategy(pass1Diagnostics, metadataCompleteness, config);
    addEvent({ stage: 'gate', outcome: 'run', reason: trigger.trigger, reasonCode: trigger.trigger || RAG_LOOP_REASON_CODES.GATE_NOT_MET });
    addEvent({ stage: 'gate', outcome: 'strategy_selected', reason: strategySelection.reason, reasonCode: strategySelection.reason });

    const sharedCtx = {
      config, addEvent, classifyStageError, remainingBudget, canRetryStage, retrievalRetryBaseDelayMs, trigger, topN, candidateLimit, expansionOptions, strategySelection, metadata, metadataCompleteness, pass1Diagnostics,
    };

    const enrichResult = await runEnrichmentPhase({
      ...sharedCtx,
      workingMetadata: { ...metadata },
      mergeMetadataForRecheck: (orig, enriched) => this.mergeMetadataForRecheck(orig, enriched),
      enrichWithTMDB: (tmdbId, mediaType) => this.enrichWithTMDB(tmdbId, mediaType),
    });
    if (enrichResult.hadError) hadError = true;

    const expandedMetadata = ragLoopHelpers.expandRetrievalMetadata(enrichResult.workingMetadata, { pass: 'pass2', ...expansionOptions });

    const pass2Result = await runPass2RetrievalPhase({
      ...sharedCtx,
      expandedMetadata,
      pass1Candidates,
      ragContext,
    });
    if (pass2Result.hadError) hadError = true;
    pass2Diagnostics = pass2Result.pass2Diagnostics;

    const policyResult2 = await runPolicyRecheckPhase({
      ...sharedCtx,
      pass2Diagnostics,
      expandedMetadata,
      pass2EvidenceMatches: pass2Result.pass2EvidenceMatches,
      policyResult,
      baselineResult,
      libraries,
      pass2RagContext: pass2Result.pass2RagContext,
      buildPolicyRecheckCandidate: (params) => this.buildPolicyRecheckCandidate(params),
    });
    if (policyResult2.hadError) hadError = true;

    const aiResult = await runAiRerunPhase({
      ...sharedCtx,
      pass2Diagnostics,
      expandedMetadata,
      libraries,
      signalContext,
      pass2RagContext: pass2Result.pass2RagContext,
      baselineResult,
      policyResult: policyResult2.policyAfter,
      policyAfter: policyResult2.policyAfter,
      aiCallsUsed,
      buildAiRerunCandidate: (params) => this.buildAiRerunCandidate(params),
      buildAiRerunFailureEvent: (params) => this.buildAiRerunFailureEvent(params),
      aiClassify: (md, libs, sig, opts) => this.aiClassify(md, libs, sig, opts),
      existingCandidate: policyResult2.pass2Candidate,
    });
    if (aiResult.hadError) hadError = true;
    aiCallsUsed = aiResult.aiCallsUsed;
    let pass2Candidate = aiResult.pass2Candidate;

    if (!pass2Candidate && pass2Result.pass2Matches && pass2Result.pass2Matches.length > 0 && pass2Result.pass2RagContext?.suggestion) {
      const ragSuggestion = pass2Result.pass2RagContext.suggestion;
      const ragLibrary = libraries.find((library) => library.name === ragSuggestion || library.id === ragSuggestion);
      if (ragLibrary) {
        const ragConfidence = Math.max(Number(baselineResult?.confidence || 0), Math.min(75, Number(pass2Diagnostics.topSimilarity || 0) * 100));
        pass2Candidate = { ...baselineResult, library: ragLibrary, confidence: ragConfidence, method: 'rag_improved', reason: 'Pass2 RAG retrieval found stronger matches', ragContext: pass2Result.pass2RagContext, policyResult: policyResult2.policyAfter || policyResult };
        addEvent({ stage: 'rag_candidate', outcome: 'applied', reason: 'rag_candidate_built', reasonCode: 'rag_candidate_built' });
      }
    }

    const comparison = comparePassResults({ baselineResult, pass2Result: pass2Candidate, policyGate: policyResult2.policyGate, pass1Diagnostics, pass2Diagnostics, pass2Conflict: pass2Result.pass2Conflict, config });
    const resolution = resolveConflictDecision({ baselineResult, pass2Result: pass2Candidate, comparison, policyBefore: policyResult, policyAfter: policyResult2.policyAfter, pass2Conflict: pass2Result.pass2Conflict });
    const learning = isLearningEligible({ config, rolloutMode, secondPassApplied: comparison.adopt, userValidated: false, machineOnly: true });
    const trace = buildTraceSafely({ ran: true, strategy: strategySelection.strategy, comparison, resolution, learning, timing: { total: Date.now() - loopStart } });
    const decision = applyOrShadowDecision({ baselineResult, resolvedResult: resolution.resolvedResult, comparison, rolloutMode, trace });
    ragLoopMetricsCollector.recordEvaluation({ rolloutMode: decision.mode, wouldUpgrade: decision.wouldAdopt, adopted: decision.adopted, hadError, latencyDeltaMs: (Date.now() - loopStart) - Number(baselineResult?.signalContext?.processingTimeMs || 0) });
    await this.maybeApplyRolloutAutomation({ config, decision, correlationId, sampleRecorded: true });
    return withRagLoopLogContext(decision.finalResult, strategySelection.strategy);
  }
}

export const classificationRagLoopService = new ClassificationRagLoopService();
