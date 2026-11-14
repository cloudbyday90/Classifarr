/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ragRecheckAdviceFixture } from './ragRecheckAdviceFixture.mjs';
import { holdAdoptedCurrentPolicyReviewSource, retainAdoptedCurrentPolicyReviewStage } from '../../services/adoptedRagCurrentPolicyReview.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameLive.mjs';

/** Mint select before the evaluator finishes its live capture, never by mutating a confirm receipt. */
export async function adoptedSelectPolicyReviewFixture(options = {}) {
  const value = await ragRecheckAdviceFixture({ confidence: 75, afterEvaluate: row => { row.score = 70; }, ...options, action: 'prompt_select' });
  const args = { policyResult: value.result, metadata: value.item, libraries: value.libraries };
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args), args);
  const published = publishCurrentPolicyReviewFrame(value.candidate, { ...value.candidate });
  return { ...value, args, published, frame: projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)) };
}
