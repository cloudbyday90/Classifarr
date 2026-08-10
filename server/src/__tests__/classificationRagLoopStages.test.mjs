/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { runAiRerunStage } from '../services/classificationRagLoopStages.mjs';
import { ragLoopResilienceManager } from '../services/ragLoopResilienceManager.mjs';

const libraries = [{ id: 1, name: 'Movies', media_type: 'movie' }];

function createContext(overrides = {}) {
  return {
    config: {
      policy_recheck_max_ai_calls_per_item: 2,
      policy_recheck_min_similarity_delta: 0,
      policy_recheck_min_margin_delta: 0,
    },
    addEvent: jest.fn(),
    classifyStageError: jest.fn().mockResolvedValue({ reasonCode: 'ai_rerun_failed' }),
    trigger: { trigger: 'policy_prompt_select' },
    aiCallsUsed: 0,
    pass1Diagnostics: { topSimilarity: 0, marginPoints: 0 },
    pass2Diagnostics: { topSimilarity: 1, marginPoints: 100 },
    policyAfter: {
      action: 'prompt_select',
      ranked: [{ library_id: 1, score: 80 }],
      library: { library_id: 1, library_name: 'Movies' },
    },
    expandedMetadata: { title: 'Example', media_type: 'movie' },
    libraries,
    signalContext: { confidence: 80, suggestedLibrary: libraries[0] },
    pass2RagContext: { similarItems: [] },
    baselineResult: { confidence: 80, library: libraries[0] },
    buildAiRerunCandidate: jest.fn().mockReturnValue({ method: 'ai_rerun' }),
    buildAiRerunFailureEvent: jest.fn(),
    aiClassify: jest.fn().mockResolvedValue({
      library: libraries[0],
      confidence: 80,
      verified_by_ai: true,
    }),
    existingCandidate: null,
    ...overrides,
  };
}

describe('classificationRagLoopStages.runAiRerunStage', () => {
  beforeEach(() => {
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    jest.spyOn(ragLoopResilienceManager, 'recordSuccess').mockImplementation(() => {});
    jest.spyOn(ragLoopResilienceManager, 'recordFailure').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not reintroduce AI verification after an ambiguous policy recheck', async () => {
    const ctx = createContext();

    const result = await runAiRerunStage(ctx);

    expect(result).toEqual({ pass2Candidate: null, aiCallsUsed: 0, hadError: false });
    expect(ctx.aiClassify).not.toHaveBeenCalled();
    expect(ctx.addEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'ai_rerun',
      outcome: 'skipped',
      reasonCode: 'ambiguous_policy_candidates',
    }));
  });

  test('uses verification only for a unique rechecked review candidate', async () => {
    const ctx = createContext({
      trigger: { trigger: 'policy_prompt_confirm' },
      policyAfter: {
        action: 'prompt_confirm',
        ranked: [{ library_id: 1, score: 80 }],
        library: { library_id: 1, library_name: 'Movies' },
      },
    });

    await runAiRerunStage(ctx);

    expect(ctx.aiClassify).toHaveBeenCalledWith(
      ctx.expandedMetadata,
      libraries,
      ctx.signalContext,
      { mode: 'verify', ragContext: ctx.pass2RagContext },
    );
    expect(ctx.buildAiRerunCandidate).toHaveBeenCalledWith(expect.objectContaining({
      aiRerunMatch: expect.objectContaining({
        deterministic_ai_mode: expect.objectContaining({
          mode: 'verify',
          reasonCode: 'unique_review_candidate',
        }),
      }),
    }));
  });
});
