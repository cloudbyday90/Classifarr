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
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const policyEngine = {
  evaluateItem: jest.fn(),
};

jest.unstable_mockModule('../services/policyEngine.mjs', () => createNamedMockModule('policyEngine', policyEngine));

const classificationAiService = {
  aiClassify: jest.fn(),
};

jest.unstable_mockModule('../services/classificationAiService.mjs', () => ({ ...classificationAiService }));
const ragRetriever = {
  getSuggestedLibrary: jest.fn().mockReturnValue(null),
};

const classificationPhaseServiceObj = {
  updatePhase: jest.fn(),
};

const buildSignalContext = jest.fn();
const ensureDecisionQuestion = jest.fn();
const isAiTransientAvailabilityError = jest.fn();
const buildPendingRetryResult = jest.fn();
const evaluateRagLoopSecondPass = jest.fn();

const classificationUtilsService = {
  isAiTransientAvailabilityError,
  buildPendingRetryResult,
};

const classificationRagLoopService = {
  evaluateRagLoopSecondPass,
};

jest.unstable_mockModule('../services/policyScoringContextBuilder.mjs', () => ({
  buildSignalContext,
  default: { buildSignalContext },
}));

jest.unstable_mockModule('../services/classificationRagLoopService.mjs', () => ({
  ...classificationRagLoopService,
  classificationRagLoopService: classificationRagLoopService,
  default: classificationRagLoopService,
}));

jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => ({
  ...classificationUtilsService,
}));

jest.unstable_mockModule('../services/classificationPhaseService.mjs', () => ({
  ...classificationPhaseServiceObj,
  classificationPhaseService: classificationPhaseServiceObj,
}));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({
  ...ragRetriever,
  ragRetriever: ragRetriever,
  default: ragRetriever,
}));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => ({ ensureDecisionQuestion }));
const policyScoringContextBuilder = { buildSignalContext };
const classificationRoutingService = { ensureDecisionQuestion };
const { execute } = await import('../services/classificationPolicyPathService.mjs');

const libraries = [
  { id: 1, name: 'Movies' },
  { id: 2, name: 'Shows' },
];

const baseParams = {
  metadata: { title: 'Test Film', tmdb_id: 111, media_type: 'movie' },
  libraries,
  taskId: null,
  relatedEvidence: [],
};

beforeEach(() => {
  policyEngine.evaluateItem.mockReset().mockResolvedValue(null);
  policyScoringContextBuilder.buildSignalContext.mockReset().mockReturnValue(null);
  classificationAiService.aiClassify.mockReset();
  classificationRagLoopService.evaluateRagLoopSecondPass.mockReset();
  classificationUtilsService.isAiTransientAvailabilityError.mockReset().mockReturnValue(false);
  classificationUtilsService.buildPendingRetryResult.mockReset().mockReturnValue({ needs_retry: true });
  classificationRoutingService.ensureDecisionQuestion.mockReset().mockImplementation(async ({ result }) => result);
});

describe('classificationPolicyPathService.execute', () => {
  it('returns { handled: false } when policyEngine returns null (no ranked)', async () => {
    policyEngine.evaluateItem.mockResolvedValue(null);
    const out = await execute(baseParams);
    expect(out.handled).toBe(false);
  });

  it('returns { handled: false, policyResult: null } when policyEngine throws', async () => {
    policyEngine.evaluateItem.mockRejectedValue(new Error('DB offline'));
    const out = await execute(baseParams);
    expect(out.handled).toBe(false);
    expect(out.policyResult).toBeNull();
  });

  it('returns { handled: false } when policyEngine returns empty ranked list', async () => {
    policyEngine.evaluateItem.mockResolvedValue({ ranked: [], confidence: 0 });
    const out = await execute(baseParams);
    expect(out.handled).toBe(false);
  });

  it('returns policy_auto result immediately when action is auto_classify', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'auto_classify',
      confidence: 99,
      library: { library_id: 1, library_name: 'Movies', policy_name: 'Film Policy' },
    });
    const out = await execute(baseParams);
    expect(out.handled).toBe(true);
    expect(out.result.method).toBe('policy_auto');
    expect(out.result.library.id).toBe(1);
    expect(classificationAiService.aiClassify).not.toHaveBeenCalled();
  });

  it('returns { handled: false } when auto_classify library is not found in libraries list', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'auto_classify',
      confidence: 99,
      library: { library_id: 999, library_name: 'Unknown', policy_name: 'X' },
    });
    const out = await execute(baseParams);
    expect(out.handled).toBe(false);
    expect(out.policyResult).toBeNull();
  });

  it('returns { handled: true, result } with ai_analysis method when AI succeeds', async () => {
    const ranked = [{ library_id: 1, score: 80 }];
    policyEngine.evaluateItem.mockResolvedValue({ ranked, confidence: 75, ragCache: null });
    policyScoringContextBuilder.buildSignalContext.mockReturnValue({ confidence: 75, suggestedLibrary: libraries[0] });
    classificationAiService.aiClassify.mockResolvedValue({
      library: libraries[0], confidence: 80, verified_by_ai: false,
    });
    classificationRagLoopService.evaluateRagLoopSecondPass.mockResolvedValue({
      library: libraries[0], confidence: 80, method: 'ai_analysis',
    });

    const out = await execute(baseParams);
    expect(out.handled).toBe(true);
    expect(classificationAiService.aiClassify).toHaveBeenCalled();
  });

  it('returns needs_retry result when AI is unavailable and confidence < 50', async () => {
    const ranked = [{ library_id: 1, score: 40 }];
    policyEngine.evaluateItem.mockResolvedValue({ ranked, confidence: 30 });
    policyScoringContextBuilder.buildSignalContext.mockReturnValue({ confidence: 30, suggestedLibrary: null });
    classificationAiService.aiClassify.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(true);

    const out = await execute(baseParams);
    expect(out.handled).toBe(true);
    expect(out.result.needs_retry).toBe(true);
    expect(classificationUtilsService.buildPendingRetryResult).toHaveBeenCalled();
  });

  it('returns signal_calculation when AI fails, confidence ≥ 50, suggestedLibrary present', async () => {
    const ranked = [{ library_id: 1, score: 70 }];
    policyEngine.evaluateItem.mockResolvedValue({ ranked, confidence: 65 });
    policyScoringContextBuilder.buildSignalContext.mockReturnValue({
      confidence: 65, suggestedLibrary: libraries[0],
    });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.handled).toBe(true);
    expect(out.result.method).toBe('signal_calculation');
  });

  it('returns fallback when AI fails, no suggestedLibrary, confidence >= 50 (not transient)', async () => {
    const ranked = [{ library_id: 1, score: 60 }];
    policyEngine.evaluateItem.mockResolvedValue({ ranked, confidence: 60 });
    policyScoringContextBuilder.buildSignalContext.mockReturnValue({ confidence: 60, suggestedLibrary: null });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.handled).toBe(true);
    expect(out.result.method).toBe('fallback');
  });
});
