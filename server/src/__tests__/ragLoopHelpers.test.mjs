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
    TRACE_VERSION,
    RAG_LOOP_FALLBACK_ACTIONS,
    RAG_LOOP_REASON_CODES,
    applyOrShadowDecision,
    buildRagLoopTrace,
    classifyDbSqlState,
    comparePassResults,
    detectRagConflict,
    evaluatePolicyRecheckGate,
    expandRetrievalMetadata,
    getRecheckEligibility,
    getMetadataCompleteness,
    isAiRerunEligible,
    isRetryableDbConflictError,
    isLearningEligible,
    isMetadataEnrichmentEligible,
    resolvePolicyContextOrFallback,
    resolveConflictDecision,
    selectRetryStrategy,
    shouldTriggerSecondPass,
    summarizePassDiagnostics
} from '../utils/ragLoopHelpers.mjs';
import * as ragLoopHelpersModule from '../utils/ragLoopHelpers.mjs';

describe('ragLoopHelpers', () => {
    test('native ESM barrel re-exports the split helper surface', () => {
        expect(ragLoopHelpersModule.shouldTriggerSecondPass).toBe(shouldTriggerSecondPass);
        expect(ragLoopHelpersModule.buildRagLoopTrace).toBe(buildRagLoopTrace);
    });

    describe('shouldTriggerSecondPass', () => {
        test('uses policy-first trigger when prompt_select is present', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    rag_loop_low_confidence_threshold: 70
                },
                policyResult: { action: 'prompt_select' },
                aiResult: { confidence: 40 }
            });

            expect(result.run).toBe(true);
            expect(result.trigger).toBe('policy_prompt_select');
        });

        test('skips policy prompt trigger when confidence is above auto threshold without risk signals', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    policy_recheck_skip_when_ai_confident_enabled: true
                },
                policyResult: {
                    action: 'prompt_select',
                    ranked: [
                        { score: 75, auto_classify_threshold: 70, prompt_threshold: 60 }
                    ]
                },
                aiResult: { confidence: 92, needs_clarification: false },
                signalContext: { hasConflict: false }
            });

            expect(result.run).toBe(false);
            expect(result.trigger).toBe('policy_prompt_select');
            expect(result.reason).toBe('policy_prompt_risk_clear');
        });

        test('does not skip policy prompt trigger when prompt-risk signals are present', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    policy_recheck_skip_when_ai_confident_enabled: true
                },
                policyResult: {
                    action: 'prompt_select',
                    ranked: [
                        { score: 75, auto_classify_threshold: 70, prompt_threshold: 60 },
                        { score: 68, auto_classify_threshold: 70, prompt_threshold: 60 }
                    ]
                },
                aiResult: { confidence: 92, needs_clarification: false },
                signalContext: { hasConflict: true }
            });

            expect(result.run).toBe(true);
            expect(result.trigger).toBe('policy_prompt_select');
            expect(result.reason).toBe('policy_first');
        });

        test('uses ai trigger only when policy context is unavailable', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    rag_loop_low_confidence_threshold: 70
                },
                policyResult: null,
                aiResult: { confidence: 65, needs_clarification: false }
            });

            expect(result.run).toBe(true);
            expect(result.trigger).toBe('ai_low_confidence');
        });

        test('skips the second pass entirely when max passes is limited to one', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    rag_loop_max_passes: 1,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    rag_loop_low_confidence_threshold: 70
                },
                policyResult: { action: 'prompt_select' },
                aiResult: { confidence: 40 }
            });

            expect(result.run).toBe(false);
            expect(result.trigger).toBe(null);
            expect(result.reason).toBe('max_passes_reached');
        });

        test('uses ai trigger when policy result is present but non-actionable', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    rag_loop_low_confidence_threshold: 70
                },
                policyResult: {
                    action: 'manual',
                    ranked: []
                },
                aiResult: { confidence: 65, needs_clarification: false }
            });

            expect(result.run).toBe(true);
            expect(result.trigger).toBe('ai_low_confidence');
            expect(result.reason).toBe('policy_unavailable');
        });

        test('uses policy_prompt_confirm trigger when action is prompt_confirm', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true
                },
                policyResult: { action: 'prompt_confirm', ranked: [{ score: 68, auto_classify_threshold: 75 }] },
                aiResult: { confidence: 60 }
            });

            expect(result.run).toBe(true);
            expect(result.trigger).toBe('policy_prompt_confirm');
            expect(result.reason).toBe('policy_first');
        });

        test('skips prompt_confirm trigger when AI is confident and no risk signals', () => {
            const result = shouldTriggerSecondPass({
                config: {
                    rag_retrieval_loop_enabled: true,
                    policy_recheck_below_prompt_threshold_enabled: true,
                    policy_recheck_skip_when_ai_confident_enabled: true
                },
                policyResult: {
                    action: 'prompt_confirm',
                    ranked: [{ score: 72, auto_classify_threshold: 70 }]
                },
                aiResult: { confidence: 88, needs_clarification: false },
                signalContext: { hasConflict: false }
            });

            expect(result.run).toBe(false);
            expect(result.trigger).toBe('policy_prompt_confirm');
            expect(result.reason).toBe('policy_prompt_risk_clear');
        });
    });

    describe('detectRagConflict', () => {
        test('returns true for split vote/margin conflict', () => {
            const matches = [
                { libraryId: 1, libraryName: 'A', similarity: 0.70 },
                { libraryId: 1, libraryName: 'A', similarity: 0.68 },
                { libraryId: 2, libraryName: 'B', similarity: 0.69 },
                { libraryId: 2, libraryName: 'B', similarity: 0.67 }
            ];

            const result = detectRagConflict(matches, {
                rag_conflict_top_n: 5,
                rag_conflict_min_matches: 3,
                rag_conflict_min_votes_per_library: 2,
                rag_conflict_max_vote_gap: 1,
                rag_conflict_max_similarity_margin_ratio: 0.1,
                rag_conflict_min_avg_similarity: 0.55
            });

            expect(result.isConflict).toBe(true);
            expect(result.reason).toBe('vote_margin_split');
        });

        test('returns false when evidence is dominated by one library', () => {
            const matches = [
                { libraryId: 1, libraryName: 'A', similarity: 0.95 },
                { libraryId: 1, libraryName: 'A', similarity: 0.91 },
                { libraryId: 1, libraryName: 'A', similarity: 0.90 },
                { libraryId: 2, libraryName: 'B', similarity: 0.70 }
            ];

            const result = detectRagConflict(matches, {});
            expect(result.isConflict).toBe(false);
            expect(result.reason).toBe('strong_dominance');
        });
    });

    describe('selectRetryStrategy', () => {
        test('prefers hybrid for low-signal pass1', () => {
            const strategy = selectRetryStrategy(
                { matchCount: 1, topSimilarity: 0.40, conflict: { isConflict: false } },
                { isSparse: false },
                { rag_retry_strategy: 'auto', rag_retry_low_signal_similarity_floor: 0.55 }
            );

            expect(strategy.strategy).toBe('hybrid');
            expect(strategy.reason).toBe('low_signal');
        });

        test('can disable hybrid fallback for low-signal retries', () => {
            const strategy = selectRetryStrategy(
                { matchCount: 1, topSimilarity: 0.40, conflict: { isConflict: false } },
                { isSparse: false },
                {
                    rag_retry_strategy: 'auto',
                    rag_retry_low_signal_similarity_floor: 0.55,
                    rag_loop_use_hybrid_on_retry: false
                }
            );

            expect(strategy.strategy).toBe('semantic');
            expect(strategy.reason).toBe('low_signal');
        });

        test('prefers semantic for high-quality conflict in auto mode', () => {
            const strategy = selectRetryStrategy(
                { matchCount: 4, topSimilarity: 0.80, conflict: { isConflict: true } },
                { isSparse: false },
                {
                    rag_retry_strategy: 'auto',
                    rag_retry_conflict_semantic_preferred: true
                }
            );

            expect(strategy.strategy).toBe('semantic');
            expect(strategy.reason).toBe('conflict_detected');
        });
    });

    describe('policy recheck/comparator', () => {
        test('accepts upgraded policy action when measurable improvement is present', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.60 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.72 }
            ]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 55 },
                policyAfter: { action: 'prompt_confirm', confidence: 66 },
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            expect(gate.shouldAdopt).toBe(true);

            const compare = comparePassResults({
                baselineResult: { confidence: 61 },
                pass2Result: { confidence: 67 },
                policyGate: gate,
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            expect(compare.adopt).toBe(true);
            expect(compare.reason).toBe('policy_gate');
        });

        test('adopts on significant improvement without action upgrade', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.50 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.68 }
            ]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 40 },
                policyAfter: { action: 'prompt_select', confidence: 55 },
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            // No action upgrade (both prompt_select), but confidence gain is 15 >= 2x minConfidenceGain (10)
            expect(gate.shouldAdopt).toBe(true);
        });

        test('respects configurable confidence gain multiplier (3x)', () => {
            // minConfidenceGain=5, multiplier=3 → threshold is 15
            const pass1Diagnostics = summarizePassDiagnostics([{ libraryId: 1, similarity: 0.50 }]);
            const pass2Diagnostics = summarizePassDiagnostics([{ libraryId: 1, similarity: 0.55 }]);

            const gateBelow = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 40 },
                policyAfter: { action: 'prompt_select', confidence: 54 }, // +14, below 3x threshold
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5,
                    policy_recheck_confidence_gain_multiplier: 3
                }
            });
            expect(gateBelow.shouldAdopt).toBe(false);

            const gateAbove = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 40 },
                policyAfter: { action: 'prompt_select', confidence: 56 }, // +16, meets 3x threshold
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5,
                    policy_recheck_confidence_gain_multiplier: 3
                }
            });
            expect(gateAbove.shouldAdopt).toBe(true);
        });

        test('multiplier of 1 allows adoption on any measurable confidence gain', () => {
            // minConfidenceGain=5, multiplier=1 → threshold is 5 (same as base)
            const pass1Diagnostics = summarizePassDiagnostics([{ libraryId: 1, similarity: 0.50 }]);
            const pass2Diagnostics = summarizePassDiagnostics([{ libraryId: 1, similarity: 0.55 }]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 40 },
                policyAfter: { action: 'prompt_select', confidence: 46 }, // +6, meets 1x threshold
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5,
                    policy_recheck_confidence_gain_multiplier: 1
                }
            });
            expect(gate.shouldAdopt).toBe(true);
        });

        test('comparePassResults adopts via confidence alone (OR-based)', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.60 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.61 }
            ]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 50 },
                policyAfter: { action: 'prompt_confirm', confidence: 62 },
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            const compare = comparePassResults({
                baselineResult: { confidence: 50 },
                pass2Result: { confidence: 62 },
                policyGate: gate,
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            // Confidence improved (+12), similarity did NOT meet delta — OR gate should still adopt
            expect(compare.adopt).toBe(true);
        });

        test('comparePassResults blocks adoption when pass2 conflict persists even if policy gate would adopt', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.60 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 2, similarity: 0.76 },
                { libraryId: 1, similarity: 0.75 }
            ]);

            const compare = comparePassResults({
                baselineResult: { confidence: 50 },
                pass2Result: { confidence: 68 },
                policyGate: {
                    shouldAdopt: true,
                    metrics: { confidenceGain: 18 }
                },
                pass1Diagnostics,
                pass2Diagnostics,
                pass2Conflict: {
                    isConflict: true,
                    reason: 'vote_margin_split'
                },
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            expect(compare.adopt).toBe(false);
            expect(compare.reason).toBe('conflict_persists');
        });

        test('resolveConflictDecision preserves baseline when pass2 conflict persists even if policy upgraded', () => {
            const resolution = resolveConflictDecision({
                baselineResult: { library: { id: 1 }, confidence: 55 },
                pass2Result: { library: { id: 2 }, confidence: 74 },
                comparison: { adopt: true, reason: 'policy_gate' },
                policyBefore: { action: 'prompt_select' },
                policyAfter: { action: 'prompt_confirm' },
                pass2Conflict: {
                    isConflict: true,
                    reason: 'vote_margin_split'
                }
            });

            expect(resolution.source).toBe('baseline');
            expect(resolution.reason).toBe('conflict_persists');
            expect(resolution.resolvedResult.library.id).toBe(1);
        });

        test('blocks adoption when policyAfter has language conflicts and resolves to auto_classify', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.58 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.80 }
            ]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 45 },
                policyAfter: {
                    action: 'auto_classify',
                    confidence: 82,
                    languageConflicts: [
                        { policy_id: 5, library_id: 11, library_name: 'Anime Movies', item_language: 'zh', required_languages: ['ja'] }
                    ]
                },
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            // Even though confidence gain and similarity delta both qualify, language conflict must block
            expect(gate.shouldAdopt).toBe(false);
            expect(gate.reason).toBe('language_conflict_present');
            expect(gate.metrics.conflictCount).toBe(1);
        });

        test('does not block adoption when policyAfter has language conflicts but action is not auto_classify', () => {
            const pass1Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.58 }
            ]);
            const pass2Diagnostics = summarizePassDiagnostics([
                { libraryId: 1, similarity: 0.80 }
            ]);

            const gate = evaluatePolicyRecheckGate({
                policyBefore: { action: 'prompt_select', confidence: 45 },
                policyAfter: {
                    action: 'prompt_confirm',
                    confidence: 68,
                    languageConflicts: [
                        { policy_id: 5, library_id: 11, library_name: 'Anime Movies', item_language: 'zh', required_languages: ['ja'] }
                    ]
                },
                pass1Diagnostics,
                pass2Diagnostics,
                config: {
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10,
                    policy_recheck_min_confidence_gain: 5
                }
            });

            // prompt_confirm with language conflict is fine — candidate will have needs_clarification: true
            // and question builder will surface the conflict. Gate should adopt the upgrade.
            expect(gate.shouldAdopt).toBe(true);
            expect(gate.reason).toBe('policy_upgrade_accepted');
        });
    });

    describe('applyOrShadowDecision', () => {
        test('shadow mode keeps baseline result unchanged', () => {
            const baseline = { library: { id: 1 }, confidence: 60 };
            const candidate = { library: { id: 2 }, confidence: 80 };
            const decision = applyOrShadowDecision({
                baselineResult: baseline,
                resolvedResult: candidate,
                comparison: { adopt: true, reason: 'candidate_improved' },
                rolloutMode: 'shadow',
                trace: { mode: 'shadow' }
            });

            expect(decision.adopted).toBe(false);
            expect(decision.wouldAdopt).toBe(true);
            expect(decision.finalResult.library.id).toBe(1);
            expect(decision.finalResult.confidence).toBe(60);
            expect(decision.finalResult.ragLoopTrace).toBeDefined();
        });
    });

    describe('metadata + learning helpers', () => {
        test('expands retrieval metadata deterministically with caps', () => {
            const expanded = expandRetrievalMetadata({
                title: 'My Show',
                original_title: 'My Show Original',
                original_language: 'ja',
                keywords: ['Action', 'action', 'anime', 'space'],
                genres: ['Animation', 'Sci-Fi'],
                cast: [{ name: 'Actor One' }, { name: 'Actor Two' }],
                production_companies: [{ name: 'Studio A' }]
            }, {
                identifierCaps: { keywords: 3, genres: 2, studios: 1, cast: 1 },
                aliasEnabled: true,
                aliasMaxTerms: 2,
                minTokenLength: 2
            });

            // 'japanese' is appended after cap because language injection runs post-normalization
            expect(expanded.keywords).toEqual(['action', 'anime', 'space', 'japanese']);
            expect(expanded.genres).toEqual(['animation', 'sci-fi']);
            expect(expanded.cast).toHaveLength(1);
            expect(expanded.production_companies).toHaveLength(1);
            expect(expanded.rag_query_overrides.alias_terms).toHaveLength(2);
            expect(expanded.rag_query_overrides.evidence_tokens.keywords).toContain('anime');
            expect(expanded.rag_query_overrides.evidence_tokens.language).toBe('ja');
        });

        test('injects language keyword for non-English original_language', () => {
            const zh = expandRetrievalMetadata({
                title: 'Ne Zha 2',
                original_language: 'zh',
                keywords: ['action'],
                genres: ['Animation']
            });
            expect(zh.keywords).toContain('chinese');
            expect(zh.rag_query_overrides.evidence_tokens.language).toBe('zh');

            const ko = expandRetrievalMetadata({
                title: 'Parasite',
                original_language: 'ko',
                keywords: ['thriller'],
                genres: ['Drama']
            });
            expect(ko.keywords).toContain('korean');
            expect(ko.rag_query_overrides.evidence_tokens.language).toBe('ko');
        });

        test('does not inject language keyword for English original_language', () => {
            const expanded = expandRetrievalMetadata({
                title: 'Avengers',
                original_language: 'en',
                keywords: ['action', 'superhero'],
                genres: ['Action']
            });
            expect(expanded.keywords).not.toContain('english');
            expect(expanded.rag_query_overrides.evidence_tokens.language).toBe('en');
        });

        test('does not double-inject language keyword when already present in keywords', () => {
            const expanded = expandRetrievalMetadata({
                title: 'Spirited Away',
                original_language: 'ja',
                keywords: ['anime', 'japanese', 'fantasy'],
                genres: ['Animation']
            });
            const japaneseCount = expanded.keywords.filter((k) => k === 'japanese').length;
            expect(japaneseCount).toBe(1);
        });

        test('reports sparse metadata and enforces learning guard', () => {
            const completeness = getMetadataCompleteness({
                title: 'Example',
                tmdb_id: 123,
                genres: [],
                keywords: []
            }, {
                policy_recheck_metadata_missing_fields_min: 2
            });

            expect(completeness.isSparse).toBe(true);

            const learning = isLearningEligible({
                config: {
                    policy_learning_second_pass_requires_manual_confirmation: true,
                    policy_learning_allow_machine_only_second_pass_feedback: false
                },
                rolloutMode: 'apply',
                secondPassApplied: true,
                userValidated: false,
                machineOnly: true
            });

            expect(learning.eligible).toBe(false);
            expect(learning.reason).toBe('manual_confirmation_required');
        });

        test('shadow mode learning can be enabled explicitly', () => {
            const learning = isLearningEligible({
                config: {
                    policy_learning_include_shadow_feedback: true,
                    policy_learning_second_pass_requires_manual_confirmation: false,
                    policy_learning_allow_machine_only_second_pass_feedback: true
                },
                rolloutMode: 'shadow',
                secondPassApplied: true,
                userValidated: false,
                machineOnly: true
            });

            expect(learning.eligible).toBe(true);
            expect(learning.reason).toBe('eligible');
        });
    });

    describe('metadata enrichment gate', () => {
        test('requires policy trigger, sparse metadata, tmdb id, and attempt budget', () => {
            const notPolicy = isMetadataEnrichmentEligible({
                trigger: 'ai_low_confidence',
                metadata: { tmdb_id: 123 },
                metadataCompleteness: { isSparse: true },
                config: { policy_recheck_metadata_enrichment_enabled: true }
            });
            expect(notPolicy.eligible).toBe(false);
            expect(notPolicy.reason).toBe('trigger_not_policy');

            const completeMetadata = isMetadataEnrichmentEligible({
                trigger: 'policy_prompt_select',
                metadata: { tmdb_id: 123 },
                metadataCompleteness: { isSparse: false },
                config: { policy_recheck_metadata_enrichment_enabled: true }
            });
            expect(completeMetadata.eligible).toBe(false);
            expect(completeMetadata.reason).toBe('metadata_complete');

            const eligible = isMetadataEnrichmentEligible({
                trigger: 'policy_prompt_select',
                metadata: { tmdb_id: 123 },
                metadataCompleteness: { isSparse: true },
                config: {
                    policy_recheck_metadata_enrichment_enabled: true,
                    policy_recheck_metadata_max_attempts: 1
                },
                attempts: 0
            });
            expect(eligible.eligible).toBe(true);
            expect(eligible.reason).toBe('eligible');

            const exhausted = isMetadataEnrichmentEligible({
                trigger: 'policy_prompt_select',
                metadata: { tmdb_id: 123 },
                metadataCompleteness: { isSparse: true },
                config: {
                    policy_recheck_metadata_enrichment_enabled: true,
                    policy_recheck_metadata_max_attempts: 1
                },
                attempts: 1
            });
            expect(exhausted.eligible).toBe(false);
            expect(exhausted.reason).toBe('attempt_cap_reached');

            const confirmEligible = isMetadataEnrichmentEligible({
                trigger: 'policy_prompt_confirm',
                metadata: { tmdb_id: 123 },
                metadataCompleteness: { isSparse: true },
                config: {
                    policy_recheck_metadata_enrichment_enabled: true,
                    policy_recheck_metadata_max_attempts: 1
                },
                attempts: 0
            });
            expect(confirmEligible.eligible).toBe(true);
            expect(confirmEligible.reason).toBe('eligible');
        });
    });

    describe('ai rerun gate', () => {
        test('enforces ai call budget and requires material improvement', () => {
            const exhausted = isAiRerunEligible({
                aiCallsUsed: 2,
                config: { policy_recheck_max_ai_calls_per_item: 2 }
            });
            expect(exhausted.eligible).toBe(false);
            expect(exhausted.reason).toBe('ai_budget_exhausted');

            const noImprovement = isAiRerunEligible({
                trigger: 'ai_low_confidence',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.62, marginPoints: 12 },
                pass2Diagnostics: { topSimilarity: 0.64, marginPoints: 15 }
            });
            expect(noImprovement.eligible).toBe(false);
            expect(noImprovement.reason).toBe('no_material_improvement');

            const policyResolved = isAiRerunEligible({
                trigger: 'policy_prompt_select',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.50, marginPoints: 5 },
                pass2Diagnostics: { topSimilarity: 0.70, marginPoints: 20 },
                policyAfter: { action: 'prompt_confirm' }
            });
            expect(policyResolved.eligible).toBe(false);
            expect(policyResolved.reason).toBe('policy_recheck_resolved');

            const policyManualFallback = isAiRerunEligible({
                trigger: 'policy_prompt_select',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.50, marginPoints: 5 },
                pass2Diagnostics: { topSimilarity: 0.70, marginPoints: 20 },
                policyAfter: { action: 'manual' }
            });
            expect(policyManualFallback.eligible).toBe(true);
            expect(policyManualFallback.reason).toBe('eligible');

            const policyMissingAction = isAiRerunEligible({
                trigger: 'policy_prompt_select',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.50, marginPoints: 5 },
                pass2Diagnostics: { topSimilarity: 0.70, marginPoints: 20 },
                policyAfter: { confidence: 61 }
            });
            expect(policyMissingAction.eligible).toBe(true);
            expect(policyMissingAction.reason).toBe('eligible');

            const eligible = isAiRerunEligible({
                trigger: 'ai_low_confidence',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.50, marginPoints: 5 },
                pass2Diagnostics: { topSimilarity: 0.70, marginPoints: 20 }
            });
            expect(eligible.eligible).toBe(true);
            expect(eligible.reason).toBe('eligible');

            // prompt_confirm resolved to auto_classify → skip AI rerun
            const confirmResolved = isAiRerunEligible({
                trigger: 'policy_prompt_confirm',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.55, marginPoints: 8 },
                pass2Diagnostics: { topSimilarity: 0.75, marginPoints: 25 },
                policyAfter: { action: 'auto_classify' }
            });
            expect(confirmResolved.eligible).toBe(false);
            expect(confirmResolved.reason).toBe('policy_recheck_resolved');

            // prompt_confirm still at prompt_confirm level → AI rerun still useful
            const confirmNotResolved = isAiRerunEligible({
                trigger: 'policy_prompt_confirm',
                aiCallsUsed: 1,
                config: {
                    policy_recheck_max_ai_calls_per_item: 3,
                    policy_recheck_min_similarity_delta: 0.08,
                    policy_recheck_min_margin_delta: 10
                },
                pass1Diagnostics: { topSimilarity: 0.55, marginPoints: 8 },
                pass2Diagnostics: { topSimilarity: 0.75, marginPoints: 25 },
                policyAfter: { action: 'prompt_confirm' }
            });
            expect(confirmNotResolved.eligible).toBe(true);
            expect(confirmNotResolved.reason).toBe('eligible');
        });
    });

    describe('Phase 4 mapping guards', () => {
        test('resolves missing policy context to deterministic fallback', () => {
            const result = resolvePolicyContextOrFallback({ policyResult: null });
            expect(result.hasPolicyContext).toBe(false);
            expect(result.reasonCode).toBe(RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING);
            expect(result.fallbackAction).toBe(RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED);
        });

        test('treats non-actionable policy results as missing policy context', () => {
            const result = resolvePolicyContextOrFallback({
                policyResult: {
                    action: 'manual',
                    ranked: []
                }
            });

            expect(result.hasPolicyContext).toBe(false);
            expect(result.reasonCode).toBe(RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING);
            expect(result.fallbackAction).toBe(RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED);
        });

        test('rejects policy recheck when tmdb/media mapping is missing', () => {
            const missingTmdb = getRecheckEligibility(
                {
                    trigger: 'policy_prompt_select',
                    policyContext: { hasPolicyContext: true }
                },
                {
                    media_type: 'movie',
                    genres: ['drama'],
                    keywords: ['family']
                },
                {
                    policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
                    policy_recheck_metadata_source: 'authoritative_only'
                }
            );
            expect(missingTmdb.eligible).toBe(false);
            expect(missingTmdb.reasonCode).toBe(RAG_LOOP_REASON_CODES.MISSING_TMDB_ID);

            const missingType = getRecheckEligibility(
                {
                    trigger: 'policy_prompt_select',
                    policyContext: { hasPolicyContext: true }
                },
                {
                    tmdb_id: 123,
                    genres: ['drama'],
                    keywords: ['family']
                },
                {
                    policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
                    policy_recheck_metadata_source: 'authoritative_only'
                }
            );
            expect(missingType.eligible).toBe(false);
            expect(missingType.reasonCode).toBe(RAG_LOOP_REASON_CODES.MISSING_MEDIA_TYPE);

            // policy_prompt_confirm should pass the trigger guard (not blocked as TRIGGER_NOT_POLICY)
            const confirmTrigger = getRecheckEligibility(
                {
                    trigger: 'policy_prompt_confirm',
                    policyContext: { hasPolicyContext: true }
                },
                {
                    media_type: 'movie',
                    genres: ['drama'],
                    keywords: ['family']
                },
                {
                    policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 }
                }
            );
            expect(confirmTrigger.eligible).toBe(false);
            // Must fail on MISSING_TMDB_ID, not on TRIGGER_NOT_POLICY
            expect(confirmTrigger.reasonCode).toBe(RAG_LOOP_REASON_CODES.MISSING_TMDB_ID);
        });

        test('rejects non-authoritative identifiers when authoritative evidence is absent', () => {
            const result = getRecheckEligibility(
                {
                    trigger: 'policy_prompt_select',
                    policyContext: { hasPolicyContext: true }
                },
                {
                    tmdb_id: 123,
                    media_type: 'movie',
                    ai_identifier_candidates: ['made-up token'],
                    genres: [],
                    keywords: [],
                    cast: [],
                    production_companies: [],
                    belongs_to_collection: null
                },
                {
                    policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
                    policy_recheck_metadata_source: 'authoritative_only'
                }
            );

            expect(result.eligible).toBe(false);
            expect(result.reasonCode).toBe(RAG_LOOP_REASON_CODES.NON_AUTHORITATIVE_IDENTIFIERS_REJECTED);
            expect(result.fallbackAction).toBe(RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED);
        });
    });

    describe('Phase 4 SQLSTATE classification', () => {
        test('classifies SQLSTATE families and retryability', () => {
            const integrity = classifyDbSqlState({ code: '23505' });
            expect(integrity.reasonCode).toBe(RAG_LOOP_REASON_CODES.DB_INTEGRITY_VIOLATION);
            expect(integrity.retryable).toBe(false);

            const retryable = classifyDbSqlState({ code: '40001' });
            expect(retryable.reasonCode).toBe(RAG_LOOP_REASON_CODES.DB_RETRYABLE_CONFLICT);
            expect(retryable.retryable).toBe(true);
            expect(isRetryableDbConflictError({ code: '40001' })).toBe(true);

            const schema = classifyDbSqlState({ code: '42P01' });
            expect(schema.reasonCode).toBe(RAG_LOOP_REASON_CODES.DB_SCHEMA_MISMATCH);
            expect(schema.retryable).toBe(false);
        });
    });

    describe('Phase 5 trace sanitization', () => {
        test('sanitizes unsupported stages and redacts sensitive reason text', () => {
            const trace = buildRagLoopTrace({
                mode: 'SHADOW',
                ran: true,
                trigger: 'policy_prompt_select',
                strategy: 'hybrid',
                events: [
                    {
                        stage: 'strategy',
                        outcome: 'selected',
                        reason: 'api_key leaked during debug',
                        reason_code: null,
                        fallback_action: null,
                        recoverable: true,
                        sql_state: null
                    }
                ],
                traceConfig: {
                    maxEvents: 20,
                    maxBytes: 16384
                }
            });

            expect(trace.trace_version).toBe(TRACE_VERSION);
            expect(trace.mode).toBe('shadow');
            expect(trace.events[0].stage).toBe('trace');
            expect(trace.events[0].reason_code).toBe('redacted');
            expect(trace.events[0].reason).toBe('redacted');
        });

        test('deterministically truncates events when max event cap is exceeded', () => {
            const trace = buildRagLoopTrace({
                mode: 'apply',
                ran: true,
                trigger: 'policy_prompt_select',
                strategy: 'hybrid',
                events: [
                    { stage: 'gate', outcome: 'run', reason_code: 'eligible' },
                    { stage: 'enrichment', outcome: 'applied', reason_code: 'metadata_updated' },
                    { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' }
                ],
                traceConfig: {
                    maxEvents: 2,
                    maxBytes: 16384
                }
            });

            expect(trace.events).toHaveLength(3);
            expect(trace.events[2].outcome).toBe('truncated');
            expect(trace.events[2].reason_code).toBe('max_events');
        });

        test('falls back to compact trace when max byte cap is exceeded', () => {
            const trace = buildRagLoopTrace({
                mode: 'apply',
                ran: true,
                trigger: 'policy_prompt_select',
                strategy: 'hybrid',
                events: [
                    { stage: 'gate', outcome: 'run', reason_code: 'eligible' },
                    { stage: 'enrichment', outcome: 'applied', reason_code: 'metadata_updated' }
                ],
                traceConfig: {
                    maxEvents: 20,
                    maxBytes: 64
                }
            });

            expect(trace.trace_version).toBe(TRACE_VERSION);
            expect(trace.decision.outcome).toBe('trace_truncated');
            expect(trace.events).toEqual([]);
        });
    });
});
