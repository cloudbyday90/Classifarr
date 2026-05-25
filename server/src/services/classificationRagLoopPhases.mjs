/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ragLoopResilienceManager } from './ragLoopResilienceManager.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { policyEngine } from './policyEngine.mjs';
import {
    sleep,
    withRetryableDbConflict,
    withTimeout,
    resolveAiFailureClassification,
} from './classificationUtilsService.mjs';
import { ragLoopHelpers } from '../utils/ragLoopHelpers.mjs';

const {
    RAG_LOOP_FALLBACK_ACTIONS,
    RAG_LOOP_REASON_CODES,
    detectRagConflict,
    extractVerifiableEvidence,
    isAiRerunEligible,
    isMetadataEnrichmentEligible,
    evaluatePolicyRecheckGate,
    summarizePassDiagnostics,
} = ragLoopHelpers;

export async function runEnrichmentPhase(ctx) {
    const { workingMetadata, config, addEvent, classifyStageError, remainingBudget, canRetryStage, retrievalRetryBaseDelayMs, mergeMetadataForRecheck, enrichWithTMDB, trigger, metadataCompleteness } = ctx;

    let resultMetadata = { ...workingMetadata };
    let enrichmentAttempts = 0;
    let enrichmentGate = isMetadataEnrichmentEligible({ trigger: trigger.trigger, metadata: resultMetadata, metadataCompleteness, config, attempts: enrichmentAttempts });

    if (!enrichmentGate.eligible || remainingBudget() <= 0) {
        addEvent({ stage: 'enrichment', outcome: 'skipped', reason: enrichmentGate.reason, reasonCode: enrichmentGate.reason, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED });
        return { workingMetadata: resultMetadata, enrichmentAttempts, hadError: false };
    }

    const resilienceGate = ragLoopResilienceManager.canRun('tmdb_enrichment', config);
    if (!resilienceGate.allowed) {
        addEvent({ stage: 'enrichment', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED });
        return { workingMetadata: resultMetadata, enrichmentAttempts, hadError: false };
    }

    const enrichmentMaxAttempts = Math.max(0, Number(config.policy_recheck_metadata_max_attempts ?? 1));
    if (enrichmentMaxAttempts <= 0) {
        addEvent({ stage: 'enrichment', outcome: 'skipped', reason: 'attempt_cap_reached', reasonCode: 'attempt_cap_reached', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED });
        return { workingMetadata: resultMetadata, enrichmentAttempts, hadError: false };
    }

    let enrichmentFinalError = null;
    let enrichmentFinalStageError = null;
    for (let attempt = 1; attempt <= enrichmentMaxAttempts; attempt += 1) {
        try {
            const timeoutMs = Math.min(Number(config.policy_recheck_metadata_timeout_ms || 2000), Math.max(1, remainingBudget()));
            const enrichedMetadata = await withTimeout(enrichWithTMDB(resultMetadata.tmdb_id, resultMetadata.media_type), timeoutMs, 'metadata_enrichment_timeout');
            enrichmentAttempts = attempt;
            resultMetadata = mergeMetadataForRecheck(resultMetadata, enrichedMetadata);
            enrichmentFinalError = null;
            enrichmentFinalStageError = null;
            break;
        } catch (error) {
            enrichmentAttempts = attempt;
            const stageError = await classifyStageError('enrichment', error, 'metadata_enrichment_failed');
            enrichmentFinalError = error;
            enrichmentFinalStageError = stageError;
            enrichmentGate = isMetadataEnrichmentEligible({ trigger: trigger.trigger, metadata: resultMetadata, metadataCompleteness, config, attempts: enrichmentAttempts });
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
        return { workingMetadata: resultMetadata, enrichmentAttempts, hadError: false };
    }

    ragLoopResilienceManager.recordFailure('tmdb_enrichment', enrichmentFinalError, config);
    const stageError = enrichmentFinalStageError || await classifyStageError('enrichment', enrichmentFinalError, 'metadata_enrichment_failed');
    addEvent({ stage: 'enrichment', outcome: 'skipped', reason: enrichmentFinalError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState, error: enrichmentFinalError });
    return { workingMetadata: resultMetadata, enrichmentAttempts, hadError: true };
}

export async function runPass2RetrievalPhase(ctx) {
    const { expandedMetadata, config, addEvent, classifyStageError, remainingBudget, canRetryStage, retrievalRetryBaseDelayMs, strategySelection, topN, ragContext } = ctx;

    let pass2Matches = [];
    let pass2Enabled = false;

    if (remainingBudget() <= 0) {
        addEvent({ stage: 'retrieval_pass2', outcome: 'skipped', reason: 'loop_budget_exhausted', reasonCode: 'loop_budget_exhausted', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED });
        return { pass2Matches, pass2Enabled, pass2EvidenceMatches: [], pass2Conflict: { isConflict: false, reason: 'budget_exhausted' }, pass2Diagnostics: {}, pass2RagContext: ragContext, pass2Candidates: [], hadError: false };
    }

    const resilienceGate = ragLoopResilienceManager.canRun('rag_pass2', config);
    if (!resilienceGate.allowed) {
        addEvent({ stage: 'retrieval_pass2', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED });
        return { pass2Matches, pass2Enabled, pass2EvidenceMatches: [], pass2Conflict: { isConflict: false, reason: 'resilience_blocked' }, pass2Diagnostics: {}, pass2RagContext: ragContext, pass2Candidates: [], hadError: false };
    }

    pass2Enabled = true;
    const pass2MaxAttempts = Math.max(1, Number(config.rag_loop_pass2_max_attempts || 2));
    const expansionOptions = ctx.expansionOptions;
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

    let hadError = false;
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

    let pass2Candidates = [];
    if (pass2Enabled && remainingBudget() > 0) {
        const candidateLimit = ctx.candidateLimit;
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
    const pass2Diagnostics = summarizePassDiagnostics(pass2EvidenceMatches, pass2Conflict, topN);
    const pass2RagContext = pass2EvidenceMatches.length > 0 ? { similarItems: pass2EvidenceMatches.slice(0, 3), suggestion: ragRetriever.getSuggestedLibrary(pass2EvidenceMatches) } : ragContext;

    return { pass2Matches, pass2Enabled, pass2EvidenceMatches, pass2Conflict, pass2Diagnostics, pass2RagContext, pass2Candidates, hadError };
}

export async function runPolicyRecheckPhase(ctx) {
    const { expandedMetadata, config, addEvent, classifyStageError, remainingBudget, canRetryStage, retrievalRetryBaseDelayMs, trigger, pass2EvidenceMatches, policyResult, baselineResult, libraries, pass2RagContext, buildPolicyRecheckCandidate } = ctx;

    let policyAfter = policyResult;
    let policyGate = { shouldAdopt: false, actionUpgraded: false, measurableImprovement: false, reason: 'policy_not_run', metrics: {} };
    let pass2Candidate = null;
    let hadError = false;

    if (!(trigger.trigger === 'policy_prompt_select' || trigger.trigger === 'policy_prompt_confirm') || remainingBudget() <= 0) {
        return { policyAfter, policyGate, pass2Candidate, hadError };
    }

    const evidence = extractVerifiableEvidence(expandedMetadata, config.policy_recheck_identifier_caps);
    const policyRecheckMaxAttempts = Math.max(0, Number(config.policy_recheck_max_attempts ?? 1));

    if (policyRecheckMaxAttempts <= 0) {
        addEvent({ stage: 'policy_recheck', outcome: 'skipped', reason: 'attempt_cap_reached', reasonCode: 'attempt_cap_reached', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
        return { policyAfter, policyGate, pass2Candidate, hadError };
    }

    if (evidence.totalTokens <= 0 && pass2EvidenceMatches.length <= 0) {
        addEvent({ stage: 'policy_recheck', outcome: 'skipped', reason: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE, reasonCode: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
        return { policyAfter, policyGate, pass2Candidate, hadError };
    }

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
        policyGate = evaluatePolicyRecheckGate({ policyBefore: policyResult, policyAfter, pass1Diagnostics: ctx.pass1Diagnostics, pass2Diagnostics: ctx.pass2Diagnostics, config });
        addEvent({ stage: 'policy_recheck', outcome: policyGate.shouldAdopt ? 'accepted' : 'evaluated', reason: policyGate.reason, reasonCode: policyGate.reason, fallbackAction: policyGate.shouldAdopt ? null : RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED });
        if (policyGate.shouldAdopt) {
            pass2Candidate = buildPolicyRecheckCandidate({ baselineResult, libraries, policyResult: policyAfter, ragContext: pass2RagContext, adoptionReason: 'Policy re-check upgraded confidence' });
        }
    } else {
        hadError = true;
        const stageError = policyRecheckStageError || await classifyStageError('policy_recheck', policyRecheckError, 'policy_recheck_failed');
        addEvent({ stage: 'policy_recheck', outcome: 'error', reason: policyRecheckError.message, reasonCode: stageError.reasonCode, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED, recoverable: stageError.recoverable, sqlState: stageError.sqlState });
    }

    return { policyAfter, policyGate, pass2Candidate, hadError };
}

export async function runAiRerunPhase(ctx) {
    const { config, addEvent, classifyStageError, trigger, aiCallsUsed, pass1Diagnostics, pass2Diagnostics, policyAfter, expandedMetadata, libraries, signalContext, pass2RagContext, baselineResult, buildAiRerunCandidate, buildAiRerunFailureEvent, aiClassify, existingCandidate } = ctx;

    if (existingCandidate) {
        addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: 'policy_candidate_selected', reasonCode: 'policy_candidate_selected', fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
        return { pass2Candidate: existingCandidate, aiCallsUsed, hadError: false };
    }

    const resilienceGate = ragLoopResilienceManager.canRun('ai_rerun', config);
    if (!resilienceGate.allowed) {
        addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: resilienceGate.reasonCode, reasonCode: resilienceGate.reasonCode, fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
        return { pass2Candidate: null, aiCallsUsed, hadError: false };
    }

    const aiRerunGate = isAiRerunEligible({ trigger: trigger.trigger, aiCallsUsed, config, pass1Diagnostics, pass2Diagnostics, policyAfter });
    if (!aiRerunGate.eligible) {
        addEvent({ stage: 'ai_rerun', outcome: 'skipped', reason: aiRerunGate.reason, reasonCode: aiRerunGate.reason, fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED });
        return { pass2Candidate: null, aiCallsUsed, hadError: false };
    }

    let pass2Candidate = null;
    let hadError = false;
    let updatedAiCallsUsed = aiCallsUsed;

    try {
        updatedAiCallsUsed += 1;
        const aiRerunMatch = await aiClassify(expandedMetadata, libraries, signalContext, { mode: 'verify', ragContext: pass2RagContext });
        pass2Candidate = buildAiRerunCandidate({ baselineResult, aiRerunMatch, libraries, signalContext, policyResult: policyAfter, ragContext: pass2RagContext });
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
        addEvent(buildAiRerunFailureEvent({
            aiFailure,
            error,
            stageError,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED,
        }));
    }

    return { pass2Candidate, aiCallsUsed: updatedAiCallsUsed, hadError };
}
