/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
  clamp,
  POLICY_ACTION_PRIORITY,
  RAG_LOOP_REASON_CODES,
  toNumber,
} from './shared.mjs';
import { hasActionablePolicyContext } from './metadata.mjs';

function getTopLibraryStats(matches = [], topN = 5) {
  const selectedMatches = (Array.isArray(matches) ? matches : [])
    .filter((match) => match && match.libraryId && Number.isFinite(Number(match.similarity)))
    .slice(0, clamp(topN, 1, 50));

  const grouped = new Map();
  for (const match of selectedMatches) {
    const key = String(match.libraryId);
    const similarity = toNumber(match.similarity, 0);

    if (!grouped.has(key)) {
      grouped.set(key, {
        libraryId: match.libraryId,
        libraryName: match.libraryName || null,
        voteCount: 0,
        totalSimilarity: 0,
      });
    }

    const entry = grouped.get(key);
    entry.voteCount += 1;
    entry.totalSimilarity += similarity;
  }

  const rankedLibraries = Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      avgSimilarity: entry.voteCount > 0 ? entry.totalSimilarity / entry.voteCount : 0,
    }))
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return b.totalSimilarity - a.totalSimilarity;
    });

  const top1 = rankedLibraries[0] || null;
  const top2 = rankedLibraries[1] || null;
  const marginPoints = top1 && top2
    ? (top1.totalSimilarity - top2.totalSimilarity) * 100
    : top1
      ? top1.totalSimilarity * 100
      : 0;

  return {
    selectedMatches,
    rankedLibraries,
    top1,
    top2,
    marginPoints,
  };
}

export function detectRagConflict(matches = [], config = {}) {
  const topN = clamp(toNumber(config.rag_conflict_top_n, 5), 1, 50);
  const minMatches = clamp(toNumber(config.rag_conflict_min_matches, 3), 1, 50);
  const minVotes = clamp(toNumber(config.rag_conflict_min_votes_per_library, 2), 1, 10);
  const maxVoteGap = clamp(toNumber(config.rag_conflict_max_vote_gap, 1), 0, 10);
  const maxMarginRatio = clamp(toNumber(config.rag_conflict_max_similarity_margin_ratio, 0.1), 0, 1);
  const minAvgSimilarity = clamp(toNumber(config.rag_conflict_min_avg_similarity, 0.55), 0, 1);

  const stats = getTopLibraryStats(matches, topN);
  const top1 = stats.top1;
  const top2 = stats.top2;

  const diagnostics = {
    candidateCount: stats.selectedMatches.length,
    topN,
    minMatches,
    minVotes,
    maxVoteGap,
    maxMarginRatio,
    minAvgSimilarity,
    top1,
    top2,
  };

  if (stats.selectedMatches.length < minMatches) {
    return {
      isConflict: false,
      reason: 'insufficient_candidates',
      diagnostics,
    };
  }

  if (!top1 || !top2) {
    return {
      isConflict: false,
      reason: 'single_library_consensus',
      diagnostics,
    };
  }

  const absoluteMargin = Math.abs(top1.totalSimilarity - top2.totalSimilarity);
  const relativeMargin = top1.totalSimilarity > 0 ? absoluteMargin / top1.totalSimilarity : 1;
  const voteGap = Math.abs(top1.voteCount - top2.voteCount);

  if (top1.voteCount >= (minVotes + 1) && relativeMargin >= 0.15) {
    return {
      isConflict: false,
      reason: 'strong_dominance',
      diagnostics: {
        ...diagnostics,
        voteGap,
        relativeMargin,
      },
    };
  }

  const isConflict =
    top1.voteCount >= minVotes &&
    top2.voteCount >= minVotes &&
    voteGap <= maxVoteGap &&
    relativeMargin <= maxMarginRatio &&
    top1.avgSimilarity >= minAvgSimilarity &&
    top2.avgSimilarity >= minAvgSimilarity;

  return {
    isConflict,
    reason: isConflict ? 'vote_margin_split' : 'quality_or_margin_not_met',
    diagnostics: {
      ...diagnostics,
      voteGap,
      relativeMargin,
    },
  };
}

export function summarizePassDiagnostics(matches = [], conflictResult = null, topN = 5) {
  const stats = getTopLibraryStats(matches, topN);
  return {
    matchCount: stats.selectedMatches.length,
    topSimilarity: toNumber(stats.selectedMatches[0]?.similarity, 0),
    marginPoints: stats.marginPoints,
    top1: stats.top1,
    top2: stats.top2,
    conflict: conflictResult || null,
  };
}

export function selectRetryStrategy(pass1Diagnostics = {}, metadataCompleteness = {}, config = {}) {
  const override = config.rag_retry_strategy;
  if (override === 'hybrid' || override === 'semantic') {
    return {
      strategy: override,
      reason: 'explicit_override',
      overrideApplied: true,
    };
  }

  const lowSignalFloor = clamp(toNumber(config.rag_retry_low_signal_similarity_floor, 0.55), 0, 1);
  const matchCount = toNumber(pass1Diagnostics.matchCount, 0);
  const topSimilarity = toNumber(pass1Diagnostics.topSimilarity, 0);
  const hasConflict = pass1Diagnostics.conflict?.isConflict === true;
  const preferSemanticOnConflict = config.rag_retry_conflict_semantic_preferred !== false;
  const preferHybridOnSparseMetadata = config.rag_retry_sparse_metadata_prefers_hybrid !== false;
  const useHybridOnRetry = config.rag_loop_use_hybrid_on_retry !== false;
  const fallbackStrategy = useHybridOnRetry ? 'hybrid' : 'semantic';

  if (matchCount === 0 || topSimilarity < lowSignalFloor) {
    return {
      strategy: fallbackStrategy,
      reason: 'low_signal',
      overrideApplied: false,
    };
  }

  if (hasConflict && preferSemanticOnConflict) {
    return {
      strategy: 'semantic',
      reason: 'conflict_detected',
      overrideApplied: false,
    };
  }

  if (metadataCompleteness.isSparse && preferHybridOnSparseMetadata) {
    return {
      strategy: fallbackStrategy,
      reason: 'sparse_metadata',
      overrideApplied: false,
    };
  }

  return {
    strategy: fallbackStrategy,
    reason: 'auto_default',
    overrideApplied: false,
  };
}

function getPolicyAction(result) {
  return result?.action || 'manual';
}

function isPolicyActionUpgrade(beforeResult, afterResult) {
  const beforeAction = getPolicyAction(beforeResult);
  const afterAction = getPolicyAction(afterResult);
  return POLICY_ACTION_PRIORITY[afterAction] > POLICY_ACTION_PRIORITY[beforeAction];
}

export function evaluatePolicyRecheckGate({
  policyBefore = null,
  policyAfter = null,
  pass1Diagnostics = {},
  pass2Diagnostics = {},
  config = {},
} = {}) {
  if (!policyBefore || !policyAfter) {
    return {
      shouldAdopt: false,
      actionUpgraded: false,
      measurableImprovement: false,
      reason: 'policy_context_missing',
      metrics: {},
    };
  }

  const actionUpgraded = isPolicyActionUpgrade(policyBefore, policyAfter);
  const confidenceGain = toNumber(policyAfter.confidence, 0) - toNumber(policyBefore.confidence, 0);
  const similarityDelta = toNumber(pass2Diagnostics.topSimilarity, 0) - toNumber(pass1Diagnostics.topSimilarity, 0);
  const marginDelta = toNumber(pass2Diagnostics.marginPoints, 0) - toNumber(pass1Diagnostics.marginPoints, 0);

  const minSimilarityDelta = clamp(toNumber(config.policy_recheck_min_similarity_delta, 0.08), 0, 1);
  const minMarginDelta = clamp(toNumber(config.policy_recheck_min_margin_delta, 10), 0, 100);
  const minConfidenceGain = clamp(toNumber(config.policy_recheck_min_confidence_gain, 5), 0, 100);

  const measurableImprovement =
    similarityDelta >= minSimilarityDelta ||
    marginDelta >= minMarginDelta ||
    confidenceGain >= minConfidenceGain;

  const confidenceGainMultiplier = clamp(toNumber(config.policy_recheck_confidence_gain_multiplier, 2), 1, 10);
  const significantImprovement =
    confidenceGain >= (minConfidenceGain * confidenceGainMultiplier) ||
    (similarityDelta >= minSimilarityDelta && marginDelta >= minMarginDelta);
  const shouldAdopt = (actionUpgraded && measurableImprovement) || significantImprovement;

  const afterLanguageConflicts = Array.isArray(policyAfter.languageConflicts)
    ? policyAfter.languageConflicts
    : [];
  if (shouldAdopt && afterLanguageConflicts.length > 0 && policyAfter.action === 'auto_classify') {
    return {
      shouldAdopt: false,
      actionUpgraded,
      measurableImprovement,
      reason: 'language_conflict_present',
      metrics: {
        confidenceGain,
        similarityDelta,
        marginDelta,
        conflictCount: afterLanguageConflicts.length,
      },
    };
  }

  return {
    shouldAdopt,
    actionUpgraded,
    measurableImprovement,
    reason: shouldAdopt ? 'policy_upgrade_accepted' : (actionUpgraded ? 'improvement_gate_not_met' : 'policy_not_upgraded'),
    metrics: {
      confidenceGain,
      similarityDelta,
      marginDelta,
    },
  };
}

export function comparePassResults({
  baselineResult = null,
  pass2Result = null,
  policyGate = null,
  pass1Diagnostics = {},
  pass2Diagnostics = {},
  pass2Conflict = null,
  config = {},
} = {}) {
  if (!baselineResult || !pass2Result) {
    return {
      adopt: false,
      reason: 'missing_candidate',
      metrics: {},
    };
  }

  if (pass2Conflict?.isConflict === true) {
    return {
      adopt: false,
      reason: 'conflict_persists',
      metrics: {
        conflict: true,
      },
    };
  }

  if (policyGate?.shouldAdopt) {
    return {
      adopt: true,
      reason: 'policy_gate',
      metrics: policyGate.metrics || {},
    };
  }

  const confidenceGain = toNumber(pass2Result.confidence, 0) - toNumber(baselineResult.confidence, 0);
  const similarityDelta = toNumber(pass2Diagnostics.topSimilarity, 0) - toNumber(pass1Diagnostics.topSimilarity, 0);
  const marginDelta = toNumber(pass2Diagnostics.marginPoints, 0) - toNumber(pass1Diagnostics.marginPoints, 0);

  const minConfidenceGain = clamp(toNumber(config.policy_recheck_min_confidence_gain, 5), 0, 100);
  const minSimilarityDelta = clamp(toNumber(config.policy_recheck_min_similarity_delta, 0.08), 0, 1);
  const minMarginDelta = clamp(toNumber(config.policy_recheck_min_margin_delta, 10), 0, 100);

  const improvementGate =
    confidenceGain >= minConfidenceGain ||
    similarityDelta >= minSimilarityDelta ||
    marginDelta >= minMarginDelta;

  return {
    adopt: improvementGate,
    reason: improvementGate ? 'candidate_improved' : 'candidate_not_improved',
    metrics: {
      confidenceGain,
      similarityDelta,
      marginDelta,
    },
  };
}

export function resolveConflictDecision({
  baselineResult = null,
  pass2Result = null,
  comparison = null,
  policyBefore = null,
  policyAfter = null,
  pass2Conflict = null,
} = {}) {
  if (!baselineResult) {
    return {
      resolvedResult: pass2Result,
      source: 'pass2',
      reason: 'baseline_missing',
    };
  }

  if (pass2Conflict?.isConflict === true) {
    return {
      resolvedResult: baselineResult,
      source: 'baseline',
      reason: 'conflict_persists',
    };
  }

  const policyUpgraded = isPolicyActionUpgrade(policyBefore, policyAfter);
  if (policyUpgraded && comparison?.adopt && pass2Result) {
    return {
      resolvedResult: pass2Result,
      source: 'policy',
      reason: 'policy_precedence',
    };
  }

  if (comparison?.adopt && pass2Result) {
    return {
      resolvedResult: pass2Result,
      source: 'pass2',
      reason: comparison.reason || 'candidate_adopted',
    };
  }

  return {
    resolvedResult: baselineResult,
    source: 'baseline',
    reason: comparison?.reason || 'baseline_preserved',
  };
}

export function applyOrShadowDecision({
  baselineResult = null,
  resolvedResult = null,
  comparison = null,
  rolloutMode = 'shadow',
  trace = null,
} = {}) {
  const base = baselineResult ? { ...baselineResult } : null;
  const candidate = resolvedResult ? { ...resolvedResult } : null;
  const shouldAdopt = comparison?.adopt === true && !!candidate;

  if (!base) {
    const fallback = candidate || {};
    return {
      finalResult: {
        ...fallback,
        ragLoopTrace: trace || null,
      },
      adopted: shouldAdopt,
      wouldAdopt: shouldAdopt,
      mode: rolloutMode,
    };
  }

  if (rolloutMode !== 'apply') {
    return {
      finalResult: {
        ...base,
        ragLoopTrace: trace || null,
      },
      adopted: false,
      wouldAdopt: shouldAdopt,
      mode: 'shadow',
    };
  }

  if (shouldAdopt) {
    return {
      finalResult: {
        ...candidate,
        ragLoopTrace: trace || null,
      },
      adopted: true,
      wouldAdopt: true,
      mode: 'apply',
    };
  }

  return {
    finalResult: {
      ...base,
      ragLoopTrace: trace || null,
    },
    adopted: false,
    wouldAdopt: false,
    mode: 'apply',
  };
}

export function shouldTriggerSecondPass({
  config = {},
  policyResult = null,
  aiResult = null,
  signalContext = null,
} = {}) {
  if (!config.rag_retrieval_loop_enabled) {
    return {
      run: false,
      trigger: null,
      reason: 'feature_disabled',
    };
  }

  const maxPasses = clamp(toNumber(config.rag_loop_max_passes, 2), 1, 2);
  if (maxPasses < 2) {
    return {
      run: false,
      trigger: null,
      reason: RAG_LOOP_REASON_CODES.MAX_PASSES_REACHED,
    };
  }

  if (policyResult?.action === 'prompt_select' && config.policy_recheck_below_prompt_threshold_enabled) {
    const skipWhenAiConfident = config.policy_recheck_skip_when_ai_confident_enabled !== false;
    const ranked = Array.isArray(policyResult?.ranked) ? policyResult.ranked : [];
    const top = ranked[0] || null;
    const second = ranked[1] || null;
    const aiConfidence = toNumber(aiResult?.confidence, 0);
    const autoThreshold = top ? toNumber(top.auto_classify_threshold, Number.NaN) : Number.NaN;
    const hasConflictSignal = signalContext?.hasConflict === true;
    const hasNarrowPolicyGap =
      top && second &&
      Number.isFinite(toNumber(top.score, Number.NaN)) &&
      Number.isFinite(toNumber(second.score, Number.NaN)) &&
      Math.abs(toNumber(top.score, 0) - toNumber(second.score, 0)) <= 10;
    const hasPromptRiskSignal =
      aiResult?.needs_clarification === true ||
      hasConflictSignal ||
      hasNarrowPolicyGap;

    if (
      skipWhenAiConfident &&
      Number.isFinite(autoThreshold) &&
      aiConfidence >= autoThreshold &&
      !hasPromptRiskSignal
    ) {
      return {
        run: false,
        trigger: 'policy_prompt_select',
        reason: RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR,
      };
    }

    return {
      run: true,
      trigger: 'policy_prompt_select',
      reason: 'policy_first',
    };
  }

  if (policyResult?.action === 'prompt_confirm' && config.policy_recheck_below_prompt_threshold_enabled) {
    const skipWhenAiConfident = config.policy_recheck_skip_when_ai_confident_enabled !== false;
    const ranked = Array.isArray(policyResult?.ranked) ? policyResult.ranked : [];
    const top = ranked[0] || null;
    const aiConfidence = toNumber(aiResult?.confidence, 0);
    const autoThreshold = top ? toNumber(top.auto_classify_threshold, Number.NaN) : Number.NaN;
    const hasConflictSignal = signalContext?.hasConflict === true;
    const hasPromptRiskSignal = aiResult?.needs_clarification === true || hasConflictSignal;

    if (
      skipWhenAiConfident &&
      Number.isFinite(autoThreshold) &&
      aiConfidence >= autoThreshold &&
      !hasPromptRiskSignal
    ) {
      return {
        run: false,
        trigger: 'policy_prompt_confirm',
        reason: RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR,
      };
    }

    return {
      run: true,
      trigger: 'policy_prompt_confirm',
      reason: 'policy_first',
    };
  }

  const lowConfidenceThreshold = clamp(toNumber(config.rag_loop_low_confidence_threshold, 70), 0, 100);

  if (!hasActionablePolicyContext(policyResult) && aiResult && aiResult.needs_clarification !== true && toNumber(aiResult.confidence, 0) < lowConfidenceThreshold) {
    return {
      run: true,
      trigger: 'ai_low_confidence',
      reason: 'policy_unavailable',
    };
  }

  if (!hasActionablePolicyContext(policyResult) && !aiResult && signalContext && toNumber(signalContext.confidence, 0) < 60) {
    return {
      run: true,
      trigger: 'legacy_low_signal',
      reason: 'policy_and_ai_unavailable',
    };
  }

  return {
    run: false,
    trigger: null,
    reason: 'gate_not_met',
  };
}

export function isMetadataEnrichmentEligible({
  trigger = null,
  metadata = {},
  metadataCompleteness = {},
  config = {},
  attempts = 0,
} = {}) {
  if (trigger !== 'policy_prompt_select' && trigger !== 'policy_prompt_confirm') {
    return {
      eligible: false,
      reason: 'trigger_not_policy',
    };
  }

  if (!config.policy_recheck_metadata_enrichment_enabled) {
    return {
      eligible: false,
      reason: 'enrichment_disabled',
    };
  }

  const maxAttempts = clamp(toNumber(config.policy_recheck_metadata_max_attempts, 1), 0, 5);
  if (attempts >= maxAttempts) {
    return {
      eligible: false,
      reason: 'attempt_cap_reached',
    };
  }

  if (!metadata.tmdb_id) {
    return {
      eligible: false,
      reason: 'missing_tmdb_id',
    };
  }

  if (!metadataCompleteness.isSparse) {
    return {
      eligible: false,
      reason: 'metadata_complete',
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
  };
}

export function isAiRerunEligible({
  trigger = null,
  aiCallsUsed = 1,
  config = {},
  pass1Diagnostics = {},
  pass2Diagnostics = {},
  policyAfter = null,
} = {}) {
  const maxAiCalls = clamp(toNumber(config.policy_recheck_max_ai_calls_per_item, 2), 1, 5);
  if (aiCallsUsed >= maxAiCalls) {
    return {
      eligible: false,
      reason: 'ai_budget_exhausted',
    };
  }

  const similarityDelta = toNumber(pass2Diagnostics.topSimilarity, 0) - toNumber(pass1Diagnostics.topSimilarity, 0);
  const marginDelta = toNumber(pass2Diagnostics.marginPoints, 0) - toNumber(pass1Diagnostics.marginPoints, 0);

  const minSimilarityDelta = clamp(toNumber(config.policy_recheck_min_similarity_delta, 0.08), 0, 1);
  const minMarginDelta = clamp(toNumber(config.policy_recheck_min_margin_delta, 10), 0, 100);
  const materiallyImproved = similarityDelta >= minSimilarityDelta || marginDelta >= minMarginDelta;

  if (!materiallyImproved) {
    return {
      eligible: false,
      reason: 'no_material_improvement',
    };
  }

  if (
    trigger === 'policy_prompt_select' &&
    isPolicyActionUpgrade({ action: 'prompt_select' }, policyAfter)
  ) {
    return {
      eligible: false,
      reason: 'policy_recheck_resolved',
    };
  }

  if (trigger === 'policy_prompt_confirm' && policyAfter?.action === 'auto_classify') {
    return {
      eligible: false,
      reason: 'policy_recheck_resolved',
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
  };
}

export function isLearningEligible({
  config = {},
  rolloutMode = 'shadow',
  secondPassApplied = false,
  userValidated = false,
  machineOnly = true,
} = {}) {
  if (rolloutMode === 'shadow' && !config.policy_learning_include_shadow_feedback) {
    return {
      eligible: false,
      reason: 'shadow_excluded',
    };
  }

  if (!secondPassApplied) {
    return {
      eligible: true,
      reason: 'baseline_path',
    };
  }

  if (config.policy_learning_second_pass_requires_manual_confirmation && !userValidated) {
    return {
      eligible: false,
      reason: 'manual_confirmation_required',
    };
  }

  if (!config.policy_learning_allow_machine_only_second_pass_feedback && machineOnly) {
    return {
      eligible: false,
      reason: 'machine_only_blocked',
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
  };
}
