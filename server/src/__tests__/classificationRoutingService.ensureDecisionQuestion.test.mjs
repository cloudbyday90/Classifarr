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

import { jest } from '@jest/globals';
import { createNamedServiceStub } from './helpers/mockFactory.mjs';

const {
    service: policyQuestionBuilder,
    module: policyQuestionBuilderModule,
} = createNamedServiceStub('policyQuestionBuilder', ['build']);
const { build } = policyQuestionBuilder;

jest.unstable_mockModule('../services/policyQuestionBuilder.mjs', () => policyQuestionBuilderModule);

const mockClarificationThresholdManager = {
    isRequireAllConfirmationsEnabled: jest.fn().mockResolvedValue(false),
};
jest.unstable_mockModule('../services/clarificationThresholdManager.mjs', () => ({
    isRequireAllConfirmationsEnabled: mockClarificationThresholdManager.isRequireAllConfirmationsEnabled,
    default: mockClarificationThresholdManager,
}));

const { ensureDecisionQuestion } = await import('../services/classificationRoutingService.mjs');

describe('ensureDecisionQuestion', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        build.mockReset();
        mockClarificationThresholdManager.isRequireAllConfirmationsEnabled.mockReset();
        mockClarificationThresholdManager.isRequireAllConfirmationsEnabled.mockResolvedValue(false);
    });

    it('returns result unchanged when result is null', async () => {
        const result = await ensureDecisionQuestion({ metadata: {}, result: null });
        expect(result).toBeNull();
    });

    it('returns result unchanged when needs_retry is true', async () => {
        const result = { needs_retry: true };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(out).toBe(result);
        expect(build).not.toHaveBeenCalled();
    });

    it('clears clarification fields when not required', async () => {
        const result = {
            needs_clarification: false,
            method: 'rule',
            confidence: 95,
            clarification: 'stale',
            policy_question: 'stale',
            pending_reason: 'stale',
        };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(out.needs_clarification).toBe(false);
        expect(out.clarification).toBeNull();
        expect(out.policy_question).toBeNull();
        expect(out.pending_reason).toBeNull();
        expect(build).not.toHaveBeenCalled();
    });

    it('normalizes an existing question without calling the builder', async () => {
        const existingQ = { problem_summary: 'Which library?', question: 'Movies or Arthouse?' };
        const result = {
            needs_clarification: true,
            clarification: existingQ,
            policy_question: existingQ,
            pending_reason: null,
        };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(build).not.toHaveBeenCalled();
        expect(out.needs_clarification).toBe(true);
        expect(out.policy_question).not.toBe(existingQ);
        expect(out.policy_question.question).toBe('Does this item need a manual destination decision?');
        expect(out.policy_question.meta.runtime_question_normalization).toMatchObject({
            uncertainty_type: 'manual_selection_needed',
            learning: { eligible: false, tier: 'blocked' },
        });
    });

    it('builds and attaches a policy question when result has needs_clarification and no existing question', async () => {
        const builtQ = { problem_summary: 'Ambiguous genre', question: 'Is this horror or thriller?' };
        build.mockResolvedValue(builtQ);

        const result = { needs_clarification: true, clarification: null, policy_question: null };
        const metadata = { tmdb_id: 1, title: 'Test' };
        const libraries = [{ id: 1 }];

        const out = await ensureDecisionQuestion({ metadata, result, libraries });
        expect(out.needs_clarification).toBe(true);
        expect(out.clarification).not.toBe(builtQ);
        expect(out.policy_question.question).toBe('Does this item need a manual destination decision?');
        expect(out.policy_question.question).not.toContain('horror');
        expect(out.policy_question.options).toEqual([]);
        expect(out.pending_reason).toBe('Destination fit');
    });

    it('requires clarification when method is fallback', async () => {
        build.mockResolvedValue(null);
        const result = { method: 'fallback', clarification: null, policy_question: null };
        await ensureDecisionQuestion({ metadata: {}, result });
        expect(build).toHaveBeenCalled();
    });

    it('requires clarification when confidence < 70', async () => {
        build.mockResolvedValue(null);
        const result = { confidence: 55, clarification: null, policy_question: null };
        await ensureDecisionQuestion({ metadata: {}, result });
        expect(build).toHaveBeenCalled();
    });

    it('requires a question for an AI-derived result even above the route threshold', async () => {
        build.mockResolvedValue({ problem_summary: 'AI output requires review' });
        const result = {
            library: { id: 10 },
            confidence: 99,
            method: 'ai_analysis',
            clarification: null,
            policy_question: null,
            ai_authority: {
                sideEffects: { canRoute: false },
            },
            policyResult: {
                ranked: [{ library_id: 10, auto_classify_threshold: 85 }],
            },
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.needs_clarification).toBe(true);
        expect(out.pending_reason).toBe('Missing evidence');
        expect(build).toHaveBeenCalled();
    });

    it('persists policy confirmation rather than missing evidence in the confirmation band', async () => {
        build.mockResolvedValue({ problem_summary: 'Missing evidence' });
        const result = {
            library: { id: 10 },
            confidence: 75,
            method: 'ai_verified',
            clarification: null,
            policy_question: null,
            policyResult: {
                action: 'prompt_confirm',
                ranked: [{
                    library_id: 10,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85,
                }],
            },
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.pending_reason).toBe('Policy confirmation required');
        expect(out.policy_question.problem_summary).toBe('Missing evidence');
    });

    it('uses the candidate-bound policy score instead of generic recheck confidence', async () => {
        build.mockResolvedValue({ problem_summary: 'Missing evidence' });
        const result = {
            library: { id: 10 },
            confidence: 99,
            method: 'policy_recheck',
            clarification: null,
            policy_question: null,
            policyResult: {
                action: 'prompt_confirm',
                ranked: [{
                    library_id: 10,
                    score: 80,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85,
                }],
            },
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.needs_clarification).toBe(true);
        expect(out.pending_reason).toBe('Policy confirmation required');
        expect(build).toHaveBeenCalled();
    });

    it('preserves an explicit destination-selection review above the generic route threshold', async () => {
        build.mockResolvedValue({ problem_summary: 'Missing evidence' });
        const result = {
            library: { id: 10 },
            confidence: 99,
            method: 'policy_recheck',
            clarification: null,
            policy_question: null,
            policyResult: {
                action: 'prompt_select',
                ranked: [{
                    library_id: 10,
                    score: 90,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85,
                }],
            },
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.needs_clarification).toBe(true);
        expect(build).toHaveBeenCalled();
    });

    it('requires clarification when policy decision diagnostics recommend manual review', async () => {
        build.mockResolvedValue(null);
        const result = {
            confidence: 92,
            clarification: null,
            policy_question: null,
            policyResult: {
                decisionDiagnostics: {
                    requires_manual_review: true,
                    reason_code: 'weak_evidence_overlap',
                },
            },
        };
        await ensureDecisionQuestion({ metadata: {}, result });
        expect(build).toHaveBeenCalled();
    });

    it('builds a bounded manual-decision question when the legacy builder returns null', async () => {
        build.mockResolvedValue(null);
        const result = { needs_clarification: true, clarification: null, policy_question: null };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(out.needs_clarification).toBe(true);
        expect(out.clarification.question).toBe('Does this item need a manual destination decision?');
        expect(out.policy_question.meta.runtime_question_normalization).toMatchObject({
            uncertainty_type: 'manual_selection_needed',
            learning: { eligible: false, tier: 'blocked' },
        });
    });

    it('prefers result.policyResult over the passed-in policyResult arg', async () => {
        build.mockResolvedValue(null);
        const innerPolicy = { rule: 'inner' };
        const outerPolicy = { rule: 'outer' };
        const result = { needs_clarification: true, policyResult: innerPolicy, clarification: null, policy_question: null };

        await ensureDecisionQuestion({ metadata: {}, result, policyResult: outerPolicy });

        const callArg = build.mock.calls[0][0];
        expect(callArg.policyResult).toBe(innerPolicy);
    });

    it('requires clarification when confidence is below the library auto-classify threshold', async () => {
        build.mockResolvedValue({ problem_summary: 'Below threshold' });
        const result = {
            library: { id: 10 },
            confidence: 81,
            method: 'ai_analysis',
            clarification: null,
            policy_question: null,
            policyResult: {
                ranked: [{ library_id: 10, auto_classify_threshold: 85 }]
            }
        };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(out.needs_clarification).toBe(true);
        expect(out.pending_reason).toBe('Missing evidence');
        expect(build).toHaveBeenCalled();
    });

    it('requires clarification when requireAllConfirmations is enabled', async () => {
        mockClarificationThresholdManager.isRequireAllConfirmationsEnabled.mockResolvedValue(true);
        build.mockResolvedValue({ problem_summary: 'All confirmations required' });
        const result = {
            library: { id: 10 },
            confidence: 90,
            method: 'policy_auto',
            clarification: null,
            policy_question: null,
        };
        const out = await ensureDecisionQuestion({ metadata: {}, result });
        expect(out.needs_clarification).toBe(true);
        expect(out.pending_reason).toBe('Missing evidence');
        expect(build).toHaveBeenCalled();
    });

    it('requires clarification when policy_auto lacks current policy provenance', async () => {
        build.mockResolvedValue(null);
        const result = {
            library: { id: 10 },
            confidence: 99,
            method: 'policy_auto',
            clarification: null,
            policy_question: null,
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.needs_clarification).toBe(true);
        expect(build).toHaveBeenCalled();
    });

    it('requires clarification for a bounded permanent provider recovery', async () => {
        build.mockResolvedValue(null);
        const result = {
            library: { id: 10 },
            confidence: 99,
            method: 'signal_calculation',
            clarification: null,
            policy_question: null,
            policyResult: {
                ranked: [{ library_id: 10, auto_classify_threshold: 85 }],
            },
            provider_recovery: {
                version: 'provider_recovery.v1',
                mode: 'review_required',
            },
        };

        const out = await ensureDecisionQuestion({ metadata: {}, result });

        expect(out.needs_clarification).toBe(true);
        expect(build).toHaveBeenCalled();
    });
});
