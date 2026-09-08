/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import { evaluateItem } from '../../services/policyEngineEvaluation.mjs';
import {
  createHeldOutSemanticStudyPolicyEvaluationStageState,
  HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS,
} from '../../services/heldOutSemanticStudyPolicyEvaluationStage.mjs';

function dependencies({ policies }) {
  return {
    checkAuthoritativeSignals: async () => null,
    evaluatePolicy: async () => null,
    getActivePolicies: async () => policies,
  };
}

test('records no-active-policies only for the opt-in held-out evaluator state', async () => {
  const state = createHeldOutSemanticStudyPolicyEvaluationStageState();
  await evaluateItem({ media_type: 'movie', title: 'Private title' }, {
    heldOutSemanticStudyPolicyEvaluationStageState: state,
  }, dependencies({ policies: [] }));
  expect(state.stageId).toBe(HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_ACTIVE_POLICIES);
});

test('records no-compatible-media-type-policy before policy evaluation', async () => {
  const state = createHeldOutSemanticStudyPolicyEvaluationStageState();
  const evaluatePolicy = jest.fn(async () => null);
  await evaluateItem({ media_type: 'movie', title: 'Private title' }, {
    heldOutSemanticStudyPolicyEvaluationStageState: state,
  }, {
    ...dependencies({ policies: [{ library_media_type: 'tv' }] }),
    evaluatePolicy,
  });
  expect(state.stageId).toBe(
    HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_COMPATIBLE_MEDIA_TYPE_POLICIES,
  );
  expect(evaluatePolicy).not.toHaveBeenCalled();
});

test('records no-qualifying-policy-evaluations when compatible policy scores are rejected', async () => {
  const state = createHeldOutSemanticStudyPolicyEvaluationStageState();
  await evaluateItem({ media_type: 'movie', title: 'Private title' }, {
    heldOutSemanticStudyPolicyEvaluationStageState: state,
  }, {
    ...dependencies({ policies: [{ library_media_type: 'movie' }] }),
    evaluatePolicy: async () => ({ policy_id: 1, score: 0 }),
  });
  expect(state.stageId).toBe(
    HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_QUALIFYING_POLICY_EVALUATIONS,
  );
});
