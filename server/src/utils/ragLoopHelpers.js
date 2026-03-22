/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const TRACE_VERSION = 1;
const POLICY_ACTION_PRIORITY = Object.freeze({
    manual: 0,
    prompt_select: 1,
    prompt_confirm: 2,
    auto_classify: 3
});

const HIGH_IMPACT_FIELDS = Object.freeze([
    'genres',
    'keywords',
    'belongs_to_collection',
    'production_companies',
    'cast'
]);

const RAG_LOOP_REASON_CODES = Object.freeze({
    FEATURE_DISABLED: 'feature_disabled',
    GATE_NOT_MET: 'gate_not_met',
    MAX_PASSES_REACHED: 'max_passes_reached',
    POLICY_PROMPT_RISK_CLEAR: 'policy_prompt_risk_clear',
    POLICY_CONTEXT_MISSING: 'policy_context_missing',
    MISSING_TMDB_ID: 'missing_tmdb_id',
    MISSING_MEDIA_TYPE: 'missing_media_type',
    INSUFFICIENT_HIGH_IMPACT_METADATA: 'insufficient_high_impact_metadata',
    NO_VERIFIABLE_EVIDENCE: 'no_verifiable_evidence',
    NON_AUTHORITATIVE_IDENTIFIERS_REJECTED: 'non_authoritative_identifiers_rejected',
    TRIGGER_NOT_POLICY: 'trigger_not_policy',
    RAG_PASS1_CANDIDATE_FAILED: 'rag_pass1_candidate_failed',
    RAG_PASS1_CANDIDATE_TIMEOUT: 'rag_pass1_candidate_timeout',
    RAG_PASS1_CANDIDATE_PROVIDER_FAILED: 'rag_pass1_candidate_provider_failed',
    RAG_PASS1_CANDIDATE_DB_FAILED: 'rag_pass1_candidate_db_failed',
    RAG_PASS1_CANDIDATE_EMBED_FAILED: 'rag_pass1_candidate_embed_failed',
    RAG_PASS1_CANDIDATE_ABORTED: 'rag_pass1_candidate_aborted',
    RAG_PASS2_FAILED: 'rag_pass2_failed',
    RAG_PASS2_TIMEOUT: 'rag_pass2_timeout',
    RAG_PASS2_PROVIDER_FAILED: 'rag_pass2_provider_failed',
    RAG_PASS2_DB_FAILED: 'rag_pass2_db_failed',
    RAG_PASS2_EMBED_FAILED: 'rag_pass2_embed_failed',
    RAG_PASS2_ABORTED: 'rag_pass2_aborted',
    DB_INTEGRITY_VIOLATION: 'db_integrity_violation',
    DB_RETRYABLE_CONFLICT: 'db_retryable_conflict',
    DB_SCHEMA_MISMATCH: 'db_schema_mismatch',
    DB_UNKNOWN_FAILURE: 'db_unknown_failure'
});

const RAG_LOOP_FALLBACK_ACTIONS = Object.freeze({
    BASELINE_PRESERVED: 'baseline_preserved',
    GATE_SKIPPED: 'gate_skipped',
    ENRICHMENT_SKIPPED: 'enrichment_skipped',
    PASS2_SKIPPED: 'pass2_skipped',
    POLICY_RECHECK_SKIPPED: 'policy_recheck_skipped',
    AI_RERUN_SKIPPED: 'ai_rerun_skipped',
    TRACE_OMITTED: 'trace_omitted'
});

const TRACE_ALLOWED_MODES = new Set(['shadow', 'apply']);
const TRACE_ALLOWED_STAGES = new Set([
    'gate',
    'enrichment',
    'retrieval_pass2',
    'policy_recheck',
    'ai_rerun',
    'rag_candidate',
    'trace'
]);
const TRACE_ALLOWED_TRIGGERS = new Set([
    'policy_prompt_select',
    'policy_prompt_confirm',
    'ai_low_confidence',
    'legacy_low_signal'
]);
const TRACE_SENSITIVE_PATTERN = /api[_-]?key|token|authorization|password|secret|bearer/i;

// ISO 639-1 → lowercase English label used as RAG retrieval query keywords.
// Excludes 'en' (English); English-language items don't need a language hint.
const LANGUAGE_QUERY_KEYWORDS = Object.freeze({
    es: 'spanish',  fr: 'french',    de: 'german',     it: 'italian',   pt: 'portuguese',
    ru: 'russian',  ar: 'arabic',    zh: 'chinese',    ja: 'japanese',  ko: 'korean',
    hi: 'hindi',    ta: 'tamil',     te: 'telugu',     kn: 'kannada',   ml: 'malayalam',
    mr: 'marathi',  bn: 'bengali',   pa: 'punjabi',    ur: 'urdu',      th: 'thai',
    vi: 'vietnamese', id: 'indonesian', ms: 'malay',   nl: 'dutch',     pl: 'polish',
    sv: 'swedish',  da: 'danish',    nb: 'norwegian',  fi: 'finnish',   cs: 'czech',
    hu: 'hungarian', ro: 'romanian', el: 'greek',      tr: 'turkish',   uk: 'ukrainian',
    bg: 'bulgarian', hr: 'croatian', sk: 'slovak',     ca: 'catalan',   he: 'hebrew',
    fa: 'farsi'
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTraceToken(value, fallback = null, maxLength = 64) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, maxLength);

    return normalized || fallback;
}

function sanitizeTraceMode(mode) {
    const normalized = normalizeTraceToken(mode, 'shadow', 16);
    return TRACE_ALLOWED_MODES.has(normalized) ? normalized : 'shadow';
}

function sanitizeTraceTrigger(trigger) {
    const normalized = normalizeTraceToken(trigger, null, 48);
    if (!normalized) {
        return null;
    }
    return TRACE_ALLOWED_TRIGGERS.has(normalized) ? normalized : null;
}

function sanitizeTraceStage(stage) {
    const normalized = normalizeTraceToken(stage, 'trace', 48);
    return TRACE_ALLOWED_STAGES.has(normalized) ? normalized : 'trace';
}

function sanitizeTraceReason(value, fallback = null) {
    if (typeof value !== 'string') {
        return fallback;
    }
    if (TRACE_SENSITIVE_PATTERN.test(value)) {
        return 'redacted';
    }
    return normalizeTraceToken(value, fallback, 80);
}

function sanitizeTraceEvent(event = {}) {
    const stage = sanitizeTraceStage(event.stage || 'trace');
    const reasonCode = sanitizeTraceReason(event.reason_code || event.reason, null);
    const fallbackAction = sanitizeTraceReason(event.fallback_action, null);

    return {
        stage,
        outcome: normalizeTraceToken(event.outcome || 'unknown', 'unknown', 48),
        reason: reasonCode,
        reason_code: reasonCode,
        fallback_action: fallbackAction,
        recoverable: event.recoverable === false ? false : true,
        sql_state: normalizeSqlState({ code: event.sql_state || event.sqlState })
    };
}

function getStringValue(value) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (value && typeof value === 'object') {
        if (typeof value.name === 'string') {
            return value.name.trim();
        }
        if (typeof value.title === 'string') {
            return value.title.trim();
        }
    }
    return '';
}

function normalizeToken(value) {
    const text = getStringValue(value).toLowerCase();
    return text.replace(/\s+/g, ' ').trim();
}

function normalizeTokenArray(values = [], maxItems = 10, minTokenLength = 1) {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }

    const normalized = [];
    const seen = new Set();

    for (const value of values) {
        const token = normalizeToken(value);
        if (!token) {
            continue;
        }
        if (token.length < minTokenLength) {
            continue;
        }
        if (seen.has(token)) {
            continue;
        }
        seen.add(token);
        normalized.push(token);
        if (normalized.length >= maxItems) {
            break;
        }
    }

    return normalized;
}

function isMissingField(metadata, fieldName) {
    const value = metadata ? metadata[fieldName] : null;
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (value && typeof value === 'object') {
        return Object.keys(value).length === 0;
    }
    return value === null || value === undefined || value === '';
}

function getMissingHighImpactFields(metadata = {}) {
    return HIGH_IMPACT_FIELDS.filter((fieldName) => isMissingField(metadata, fieldName));
}

function getMetadataCompleteness(metadata = {}, config = {}) {
    const missingFields = getMissingHighImpactFields(metadata);
    const threshold = toNumber(config.policy_recheck_metadata_missing_fields_min, 2);

    return {
        missingFields,
        missingCount: missingFields.length,
        threshold,
        isSparse: missingFields.length >= threshold
    };
}

function normalizeSqlState(error) {
    const raw = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
    if (!raw) {
        return null;
    }
    return /^[A-Z0-9]{5}$/.test(raw) ? raw : null;
}

function classifyDbSqlState(error) {
    const sqlState = normalizeSqlState(error);
    if (!sqlState) {
        return {
            sqlState: null,
            classCode: null,
            retryable: false,
            reasonCode: RAG_LOOP_REASON_CODES.DB_UNKNOWN_FAILURE
        };
    }

    if (sqlState.startsWith('23')) {
        return {
            sqlState,
            classCode: '23',
            retryable: false,
            reasonCode: RAG_LOOP_REASON_CODES.DB_INTEGRITY_VIOLATION
        };
    }

    if (sqlState.startsWith('40')) {
        return {
            sqlState,
            classCode: '40',
            retryable: true,
            reasonCode: RAG_LOOP_REASON_CODES.DB_RETRYABLE_CONFLICT
        };
    }

    if (sqlState.startsWith('42')) {
        return {
            sqlState,
            classCode: '42',
            retryable: false,
            reasonCode: RAG_LOOP_REASON_CODES.DB_SCHEMA_MISMATCH
        };
    }

    return {
        sqlState,
        classCode: sqlState.slice(0, 2),
        retryable: false,
        reasonCode: RAG_LOOP_REASON_CODES.DB_UNKNOWN_FAILURE
    };
}

function isRetryableDbConflictError(error) {
    return classifyDbSqlState(error).retryable;
}

function hasActionablePolicyContext(policyResult = null) {
    if (!policyResult || typeof policyResult !== 'object') {
        return false;
    }

    const action = typeof policyResult.action === 'string'
        ? policyResult.action.trim().toLowerCase()
        : '';
    const ranked = Array.isArray(policyResult.ranked) ? policyResult.ranked.filter(Boolean) : [];
    const hasLibrary = !!policyResult.library;

    if (action === 'prompt_select' || action === 'prompt_confirm') {
        return true;
    }

    if ((action === 'auto_classify' || action === 'manual') && (hasLibrary || ranked.length > 0)) {
        return true;
    }

    return hasLibrary || ranked.length > 0;
}

function resolvePolicyContextOrFallback(item = {}) {
    const policyResult = item.policyResult || null;
    const hasContext = hasActionablePolicyContext(policyResult);

    if (hasContext) {
        return {
            hasPolicyContext: true,
            reasonCode: null,
            fallbackAction: null
        };
    }

    return {
        hasPolicyContext: false,
        reasonCode: RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING,
        fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED
    };
}

function getRecheckEligibility(item = {}, metadata = {}, config = {}) {
    const trigger = item.trigger || null;
    const policyContext = item.policyContext || resolvePolicyContextOrFallback(item);
    const completeness = getMetadataCompleteness(metadata, config);
    const evidence = extractVerifiableEvidence(
        metadata,
        item.identifierCaps || config.policy_recheck_identifier_caps || {}
    );
    const minHighImpactFields = clamp(
        toNumber(config.policy_recheck_min_high_impact_fields, 2),
        0,
        HIGH_IMPACT_FIELDS.length
    );
    const presentHighImpactFields = HIGH_IMPACT_FIELDS.length - completeness.missingCount;
    const aiCandidates = normalizeTokenArray(
        metadata.ai_identifier_candidates || metadata.ai_identifiers || [],
        25,
        1
    );

    if (trigger !== 'policy_prompt_select' && trigger !== 'policy_prompt_confirm') {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.TRIGGER_NOT_POLICY,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    if (!policyContext.hasPolicyContext) {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    if (!metadata.tmdb_id) {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.MISSING_TMDB_ID,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    if (!metadata.media_type) {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.MISSING_MEDIA_TYPE,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    if (config.policy_recheck_metadata_source === 'authoritative_only') {
        if (aiCandidates.length > 0 && evidence.totalTokens === 0) {
            return {
                eligible: false,
                reasonCode: RAG_LOOP_REASON_CODES.NON_AUTHORITATIVE_IDENTIFIERS_REJECTED,
                fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
                metadataCompleteness: completeness,
                evidence
            };
        }
    }

    if (presentHighImpactFields < minHighImpactFields) {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.INSUFFICIENT_HIGH_IMPACT_METADATA,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    if (evidence.totalTokens <= 0) {
        return {
            eligible: false,
            reasonCode: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            metadataCompleteness: completeness,
            evidence
        };
    }

    return {
        eligible: true,
        reasonCode: null,
        fallbackAction: null,
        metadataCompleteness: completeness,
        evidence
    };
}

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
                totalSimilarity: 0
            });
        }

        const entry = grouped.get(key);
        entry.voteCount += 1;
        entry.totalSimilarity += similarity;
    }

    const rankedLibraries = Array.from(grouped.values())
        .map((entry) => ({
            ...entry,
            avgSimilarity: entry.voteCount > 0 ? entry.totalSimilarity / entry.voteCount : 0
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
        marginPoints
    };
}

function detectRagConflict(matches = [], config = {}) {
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
        top2
    };

    if (stats.selectedMatches.length < minMatches) {
        return {
            isConflict: false,
            reason: 'insufficient_candidates',
            diagnostics
        };
    }

    if (!top1 || !top2) {
        return {
            isConflict: false,
            reason: 'single_library_consensus',
            diagnostics
        };
    }

    const absoluteMargin = Math.abs(top1.totalSimilarity - top2.totalSimilarity);
    const relativeMargin = top1.totalSimilarity > 0 ? absoluteMargin / top1.totalSimilarity : 1;
    const voteGap = Math.abs(top1.voteCount - top2.voteCount);

    // Strong dominance means this is not an actionable conflict.
    if (top1.voteCount >= (minVotes + 1) && relativeMargin >= 0.15) {
        return {
            isConflict: false,
            reason: 'strong_dominance',
            diagnostics: {
                ...diagnostics,
                voteGap,
                relativeMargin
            }
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
            relativeMargin
        }
    };
}

function summarizePassDiagnostics(matches = [], conflictResult = null, topN = 5) {
    const stats = getTopLibraryStats(matches, topN);
    return {
        matchCount: stats.selectedMatches.length,
        topSimilarity: toNumber(stats.selectedMatches[0]?.similarity, 0),
        marginPoints: stats.marginPoints,
        top1: stats.top1,
        top2: stats.top2,
        conflict: conflictResult || null
    };
}

function selectRetryStrategy(pass1Diagnostics = {}, metadataCompleteness = {}, config = {}) {
    const override = config.rag_retry_strategy;
    if (override === 'hybrid' || override === 'semantic') {
        return {
            strategy: override,
            reason: 'explicit_override',
            overrideApplied: true
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
            overrideApplied: false
        };
    }

    if (hasConflict && preferSemanticOnConflict) {
        return {
            strategy: 'semantic',
            reason: 'conflict_detected',
            overrideApplied: false
        };
    }

    if (metadataCompleteness.isSparse && preferHybridOnSparseMetadata) {
        return {
            strategy: fallbackStrategy,
            reason: 'sparse_metadata',
            overrideApplied: false
        };
    }

    return {
        strategy: fallbackStrategy,
        reason: 'auto_default',
        overrideApplied: false
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

function evaluatePolicyRecheckGate({
    policyBefore = null,
    policyAfter = null,
    pass1Diagnostics = {},
    pass2Diagnostics = {},
    config = {}
} = {}) {
    if (!policyBefore || !policyAfter) {
        return {
            shouldAdopt: false,
            actionUpgraded: false,
            measurableImprovement: false,
            reason: 'policy_context_missing',
            metrics: {}
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

    // Allow adoption when action upgraded with any improvement,
    // OR when there's significant improvement even without action upgrade
    // (e.g., multiplied confidence gain, or both similarity AND margin thresholds met).
    // Multiplier is configurable via policy_recheck_confidence_gain_multiplier (default: 2).
    const confidenceGainMultiplier = clamp(toNumber(config.policy_recheck_confidence_gain_multiplier, 2), 1, 10);
    const significantImprovement =
        confidenceGain >= (minConfidenceGain * confidenceGainMultiplier) ||
        (similarityDelta >= minSimilarityDelta && marginDelta >= minMarginDelta);
    const shouldAdopt = (actionUpgraded && measurableImprovement) || significantImprovement;

    // Language-conflict guard: if policyAfter resolves to auto_classify but the item
    // still has language-conflicting libraries detected, do NOT silently auto-route.
    // The conflict must be surfaced as a clarification question (policyQuestionBuilder),
    // not absorbed by the recheck gate. Applies to both adoption paths.
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
                conflictCount: afterLanguageConflicts.length
            }
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
            marginDelta
        }
    };
}

function comparePassResults({
    baselineResult = null,
    pass2Result = null,
    policyGate = null,
    pass1Diagnostics = {},
    pass2Diagnostics = {},
    pass2Conflict = null,
    config = {}
} = {}) {
    if (!baselineResult || !pass2Result) {
        return {
            adopt: false,
            reason: 'missing_candidate',
            metrics: {}
        };
    }

    if (pass2Conflict?.isConflict === true) {
        return {
            adopt: false,
            reason: 'conflict_persists',
            metrics: {
                conflict: true
            }
        };
    }

    if (policyGate?.shouldAdopt) {
        return {
            adopt: true,
            reason: 'policy_gate',
            metrics: policyGate.metrics || {}
        };
    }

    const confidenceGain = toNumber(pass2Result.confidence, 0) - toNumber(baselineResult.confidence, 0);
    const similarityDelta = toNumber(pass2Diagnostics.topSimilarity, 0) - toNumber(pass1Diagnostics.topSimilarity, 0);
    const marginDelta = toNumber(pass2Diagnostics.marginPoints, 0) - toNumber(pass1Diagnostics.marginPoints, 0);

    const minConfidenceGain = clamp(toNumber(config.policy_recheck_min_confidence_gain, 5), 0, 100);
    const minSimilarityDelta = clamp(toNumber(config.policy_recheck_min_similarity_delta, 0.08), 0, 1);
    const minMarginDelta = clamp(toNumber(config.policy_recheck_min_margin_delta, 10), 0, 100);

    // OR-based gate: any single meaningful improvement is enough to adopt
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
            marginDelta
        }
    };
}

function resolveConflictDecision({
    baselineResult = null,
    pass2Result = null,
    comparison = null,
    policyBefore = null,
    policyAfter = null,
    pass2Conflict = null
} = {}) {
    if (!baselineResult) {
        return {
            resolvedResult: pass2Result,
            source: 'pass2',
            reason: 'baseline_missing'
        };
    }

    if (pass2Conflict?.isConflict === true) {
        return {
            resolvedResult: baselineResult,
            source: 'baseline',
            reason: 'conflict_persists'
        };
    }

    const policyUpgraded = isPolicyActionUpgrade(policyBefore, policyAfter);
    if (policyUpgraded && comparison?.adopt && pass2Result) {
        return {
            resolvedResult: pass2Result,
            source: 'policy',
            reason: 'policy_precedence'
        };
    }

    if (comparison?.adopt && pass2Result) {
        return {
            resolvedResult: pass2Result,
            source: 'pass2',
            reason: comparison.reason || 'candidate_adopted'
        };
    }

    return {
        resolvedResult: baselineResult,
        source: 'baseline',
        reason: comparison?.reason || 'baseline_preserved'
    };
}

function truncateTrace(trace, maxEvents, maxBytes) {
    const safeMaxEvents = clamp(toNumber(maxEvents, 20), 1, 200);
    const safeMaxBytes = clamp(toNumber(maxBytes, 16384), 256, 131072);
    const trimmed = { ...trace };

    if (Array.isArray(trimmed.events) && trimmed.events.length > safeMaxEvents) {
        trimmed.events = trimmed.events.slice(0, safeMaxEvents);
        trimmed.events.push({
            stage: 'trace',
            outcome: 'truncated',
            reason: 'max_events',
            reason_code: 'max_events',
            fallback_action: 'trace_omitted',
            recoverable: true,
            sql_state: null
        });
    }

    let serialized = JSON.stringify(trimmed);
    while (serialized.length > safeMaxBytes && Array.isArray(trimmed.events) && trimmed.events.length > 0) {
        trimmed.events = trimmed.events.slice(0, trimmed.events.length - 1);
        serialized = JSON.stringify(trimmed);
    }

    if (serialized.length > safeMaxBytes) {
        return {
            trace_version: TRACE_VERSION,
            mode: sanitizeTraceMode(trimmed.mode),
            ran: false,
            decision: {
                outcome: 'trace_truncated',
                reason: 'max_bytes'
            },
            events: []
        };
    }

    return trimmed;
}

function buildRagLoopTrace({
    mode = 'shadow',
    ran = false,
    trigger = null,
    strategy = null,
    events = [],
    pass1Diagnostics = {},
    pass2Diagnostics = {},
    comparison = null,
    resolution = null,
    learning = null,
    timing = {},
    traceConfig = {}
} = {}) {
    const normalizedEvents = Array.isArray(events)
        ? events.map((event) => sanitizeTraceEvent(event))
        : [];
    const normalizedMode = sanitizeTraceMode(mode);
    const normalizedStrategy = sanitizeTraceReason(strategy, null);
    const normalizedTrigger = sanitizeTraceTrigger(trigger);

    const trace = {
        trace_version: TRACE_VERSION,
        mode: normalizedMode,
        ran,
        trigger: normalizedTrigger,
        strategy: normalizedStrategy,
        diagnostics: {
            pass1: {
                match_count: toNumber(pass1Diagnostics.matchCount, 0),
                top_similarity: toNumber(pass1Diagnostics.topSimilarity, 0),
                margin_points: toNumber(pass1Diagnostics.marginPoints, 0)
            },
            pass2: {
                match_count: toNumber(pass2Diagnostics.matchCount, 0),
                top_similarity: toNumber(pass2Diagnostics.topSimilarity, 0),
                margin_points: toNumber(pass2Diagnostics.marginPoints, 0)
            }
        },
        decision: {
            outcome: sanitizeTraceReason(resolution?.source, 'baseline'),
            reason: sanitizeTraceReason(resolution?.reason, ran ? 'no_change' : 'not_ran'),
            comparator: sanitizeTraceReason(comparison?.reason, null)
        },
        learning: learning && typeof learning === 'object'
            ? {
                eligible: learning.eligible === true,
                reason: sanitizeTraceReason(learning.reason, null)
            }
            : null,
        timing_ms: {
            total: toNumber(timing.total, 0)
        },
        events: normalizedEvents
    };

    return truncateTrace(trace, traceConfig.maxEvents, traceConfig.maxBytes);
}

function applyOrShadowDecision({
    baselineResult = null,
    resolvedResult = null,
    comparison = null,
    rolloutMode = 'shadow',
    trace = null
} = {}) {
    const base = baselineResult ? { ...baselineResult } : null;
    const candidate = resolvedResult ? { ...resolvedResult } : null;
    const shouldAdopt = comparison?.adopt === true && !!candidate;

    if (!base) {
        const fallback = candidate || {};
        return {
            finalResult: {
                ...fallback,
                ragLoopTrace: trace || null
            },
            adopted: shouldAdopt,
            wouldAdopt: shouldAdopt,
            mode: rolloutMode
        };
    }

    if (rolloutMode !== 'apply') {
        return {
            finalResult: {
                ...base,
                ragLoopTrace: trace || null
            },
            adopted: false,
            wouldAdopt: shouldAdopt,
            mode: 'shadow'
        };
    }

    if (shouldAdopt) {
        return {
            finalResult: {
                ...candidate,
                ragLoopTrace: trace || null
            },
            adopted: true,
            wouldAdopt: true,
            mode: 'apply'
        };
    }

    return {
        finalResult: {
            ...base,
            ragLoopTrace: trace || null
        },
        adopted: false,
        wouldAdopt: false,
        mode: 'apply'
    };
}

function extractVerifiableEvidence(metadata = {}, identifierCaps = {}) {
    const caps = {
        keywords: clamp(toNumber(identifierCaps.keywords, 8), 0, 25),
        genres: clamp(toNumber(identifierCaps.genres, 5), 0, 25),
        studios: clamp(toNumber(identifierCaps.studios, 3), 0, 25),
        cast: clamp(toNumber(identifierCaps.cast, 3), 0, 25)
    };

    const keywords = normalizeTokenArray(metadata.keywords || [], caps.keywords, 1);
    const genres = normalizeTokenArray(metadata.genres || [], caps.genres, 1);
    const studios = normalizeTokenArray(metadata.production_companies || metadata.studios || [], caps.studios, 1);
    const cast = normalizeTokenArray(metadata.cast || [], caps.cast, 1);

    const titles = normalizeTokenArray([
        metadata.title,
        metadata.original_title,
        metadata.original_name
    ], 3, 1);

    const collectionRaw = metadata.belongs_to_collection;
    const collection = normalizeToken(collectionRaw);

    return {
        keywords,
        genres,
        studios,
        cast,
        titles,
        collection: collection || null,
        language: metadata.original_language || null,
        totalTokens: keywords.length + genres.length + studios.length + cast.length + titles.length + (collection ? 1 : 0)
    };
}

function expandRetrievalMetadata(metadata = {}, options = {}) {
    const identifierCaps = options.identifierCaps || {};
    const minTokenLength = clamp(toNumber(options.minTokenLength, 2), 1, 10);
    const aliasEnabled = options.aliasEnabled !== false;
    const aliasMaxTerms = clamp(toNumber(options.aliasMaxTerms, 5), 1, 20);

    const evidence = extractVerifiableEvidence(metadata, identifierCaps);
    const expanded = {
        ...metadata,
        keywords: evidence.keywords,
        genres: evidence.genres,
        production_companies: evidence.studios.map((name) => ({ name })),
        cast: evidence.cast.map((name) => ({ name }))
    };

    if (!expanded.belongs_to_collection && evidence.collection) {
        expanded.belongs_to_collection = { name: evidence.collection };
    }

    const titleCandidates = [metadata.title, metadata.original_title, metadata.original_name]
        .map((title) => normalizeToken(title))
        .filter((title) => title && title.length >= minTokenLength);

    const aliasTerms = [];
    if (aliasEnabled) {
        for (const title of titleCandidates) {
            if (!aliasTerms.includes(title)) {
                aliasTerms.push(title);
            }
            if (aliasTerms.length >= aliasMaxTerms) {
                break;
            }
        }
    }

    // Add "anime" only when metadata already hints this is likely anime.
    const animeHints = new Set([...evidence.keywords, ...evidence.genres]);
    if (animeHints.has('anime') || metadata.original_language === 'ja') {
        if (!expanded.keywords.includes('anime')) {
            expanded.keywords = [...expanded.keywords, 'anime'];
        }
    }

    // Inject a language keyword for non-English original_language so retrieval
    // queries carry the language signal (e.g. 'chinese', 'korean', 'french').
    const langCode = metadata.original_language;
    if (langCode && langCode !== 'en') {
        const langKeyword = LANGUAGE_QUERY_KEYWORDS[langCode.toLowerCase()];
        if (langKeyword && !expanded.keywords.includes(langKeyword)) {
            expanded.keywords = [...expanded.keywords, langKeyword];
        }
    }

    expanded.rag_query_overrides = {
        pass: options.pass || 'pass2',
        alias_terms: aliasTerms,
        evidence_tokens: {
            keywords: evidence.keywords,
            genres: evidence.genres,
            studios: evidence.studios,
            cast: evidence.cast,
            collection: evidence.collection,
            language: evidence.language
        }
    };

    return expanded;
}

function shouldTriggerSecondPass({
    config = {},
    policyResult = null,
    aiResult = null,
    signalContext = null
} = {}) {
    if (!config.rag_retrieval_loop_enabled) {
        return {
            run: false,
            trigger: null,
            reason: 'feature_disabled'
        };
    }

    const maxPasses = clamp(toNumber(config.rag_loop_max_passes, 2), 1, 2);
    if (maxPasses < 2) {
        return {
            run: false,
            trigger: null,
            reason: RAG_LOOP_REASON_CODES.MAX_PASSES_REACHED
        };
    }

    if (policyResult?.action === 'prompt_select' && config.policy_recheck_below_prompt_threshold_enabled) {
        const skipWhenAiConfident = config.policy_recheck_skip_when_ai_confident_enabled !== false;
        const ranked = Array.isArray(policyResult?.ranked) ? policyResult.ranked : [];
        const top = ranked[0] || null;
        const second = ranked[1] || null;
        const aiConfidence = toNumber(aiResult?.confidence, 0);
        const autoThreshold = top ? toNumber(top.auto_classify_threshold, NaN) : NaN;
        const hasConflictSignal = signalContext?.hasConflict === true;
        const hasNarrowPolicyGap =
            top && second &&
            Number.isFinite(toNumber(top.score, NaN)) &&
            Number.isFinite(toNumber(second.score, NaN)) &&
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
                reason: RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR
            };
        }

        return {
            run: true,
            trigger: 'policy_prompt_select',
            reason: 'policy_first'
        };
    }

    if (policyResult?.action === 'prompt_confirm' && config.policy_recheck_below_prompt_threshold_enabled) {
        const skipWhenAiConfident = config.policy_recheck_skip_when_ai_confident_enabled !== false;
        const ranked = Array.isArray(policyResult?.ranked) ? policyResult.ranked : [];
        const top = ranked[0] || null;
        const aiConfidence = toNumber(aiResult?.confidence, 0);
        const autoThreshold = top ? toNumber(top.auto_classify_threshold, NaN) : NaN;
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
                reason: RAG_LOOP_REASON_CODES.POLICY_PROMPT_RISK_CLEAR
            };
        }

        return {
            run: true,
            trigger: 'policy_prompt_confirm',
            reason: 'policy_first'
        };
    }

    const lowConfidenceThreshold = clamp(toNumber(config.rag_loop_low_confidence_threshold, 70), 0, 100);

    if (!hasActionablePolicyContext(policyResult) && aiResult && aiResult.needs_clarification !== true && toNumber(aiResult.confidence, 0) < lowConfidenceThreshold) {
        return {
            run: true,
            trigger: 'ai_low_confidence',
            reason: 'policy_unavailable'
        };
    }

    if (!hasActionablePolicyContext(policyResult) && !aiResult && signalContext && toNumber(signalContext.confidence, 0) < 60) {
        return {
            run: true,
            trigger: 'legacy_low_signal',
            reason: 'policy_and_ai_unavailable'
        };
    }

    return {
        run: false,
        trigger: null,
        reason: 'gate_not_met'
    };
}

function isMetadataEnrichmentEligible({
    trigger = null,
    metadata = {},
    metadataCompleteness = {},
    config = {},
    attempts = 0
} = {}) {
    if (trigger !== 'policy_prompt_select' && trigger !== 'policy_prompt_confirm') {
        return {
            eligible: false,
            reason: 'trigger_not_policy'
        };
    }

    if (!config.policy_recheck_metadata_enrichment_enabled) {
        return {
            eligible: false,
            reason: 'enrichment_disabled'
        };
    }

    const maxAttempts = clamp(toNumber(config.policy_recheck_metadata_max_attempts, 1), 0, 5);
    if (attempts >= maxAttempts) {
        return {
            eligible: false,
            reason: 'attempt_cap_reached'
        };
    }

    if (!metadata.tmdb_id) {
        return {
            eligible: false,
            reason: 'missing_tmdb_id'
        };
    }

    if (!metadataCompleteness.isSparse) {
        return {
            eligible: false,
            reason: 'metadata_complete'
        };
    }

    return {
        eligible: true,
        reason: 'eligible'
    };
}

function isAiRerunEligible({
    trigger = null,
    aiCallsUsed = 1,
    config = {},
    pass1Diagnostics = {},
    pass2Diagnostics = {},
    policyAfter = null
} = {}) {
    const maxAiCalls = clamp(toNumber(config.policy_recheck_max_ai_calls_per_item, 2), 1, 5);
    if (aiCallsUsed >= maxAiCalls) {
        return {
            eligible: false,
            reason: 'ai_budget_exhausted'
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
            reason: 'no_material_improvement'
        };
    }

    if (trigger === 'policy_prompt_select' && policyAfter?.action !== 'prompt_select') {
        return {
            eligible: false,
            reason: 'policy_recheck_resolved'
        };
    }

    if (trigger === 'policy_prompt_confirm' && policyAfter?.action === 'auto_classify') {
        return {
            eligible: false,
            reason: 'policy_recheck_resolved'
        };
    }

    return {
        eligible: true,
        reason: 'eligible'
    };
}

function isLearningEligible({
    config = {},
    rolloutMode = 'shadow',
    secondPassApplied = false,
    userValidated = false,
    machineOnly = true
} = {}) {
    if (rolloutMode === 'shadow' && !config.policy_learning_include_shadow_feedback) {
        return {
            eligible: false,
            reason: 'shadow_excluded'
        };
    }

    if (!secondPassApplied) {
        return {
            eligible: true,
            reason: 'baseline_path'
        };
    }

    if (config.policy_learning_second_pass_requires_manual_confirmation && !userValidated) {
        return {
            eligible: false,
            reason: 'manual_confirmation_required'
        };
    }

    if (!config.policy_learning_allow_machine_only_second_pass_feedback && machineOnly) {
        return {
            eligible: false,
            reason: 'machine_only_blocked'
        };
    }

    return {
        eligible: true,
        reason: 'eligible'
    };
}

module.exports = {
    TRACE_VERSION,
    RAG_LOOP_REASON_CODES,
    RAG_LOOP_FALLBACK_ACTIONS,
    applyOrShadowDecision,
    buildRagLoopTrace,
    classifyDbSqlState,
    comparePassResults,
    detectRagConflict,
    evaluatePolicyRecheckGate,
    expandRetrievalMetadata,
    extractVerifiableEvidence,
    getRecheckEligibility,
    getMetadataCompleteness,
    getMissingHighImpactFields,
    isAiRerunEligible,
    isRetryableDbConflictError,
    isLearningEligible,
    isMetadataEnrichmentEligible,
    resolvePolicyContextOrFallback,
    resolveConflictDecision,
    selectRetryStrategy,
    shouldTriggerSecondPass,
    summarizePassDiagnostics
};
