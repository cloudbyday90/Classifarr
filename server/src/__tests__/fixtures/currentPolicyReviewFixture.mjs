/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { nonadoptedRagVerificationFixture } from './nonadoptedRagVerificationFixture.mjs';
import { holdNonadoptedRagVerificationSource, retainNonadoptedRagVerification, prepareNonadoptedRagVerification,
  enterNonadoptedRagVerification, retainNonadoptedCurrentPolicyReview } from '../../services/nonadoptedRagVerification.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameLive.mjs';

export async function currentPolicyReviewFixture(options = {}) {
  const value = await nonadoptedRagVerificationFixture({ afterEvaluate: row => { row.score = 70; }, ...options });
  const args = { policyResult: value.result, metadata: value.item, libraries: value.libraries };
  retainNonadoptedRagVerification(value.stage, holdNonadoptedRagVerificationSource(args));
  const prepared = prepareNonadoptedRagVerification(value.stage, args);
  enterNonadoptedRagVerification(prepared.token, { ...args, signalContext: prepared.signalContext }, prepared.candidate).assertCurrent();
  const candidate = { library: value.libraries[0], confidence: 75, method: 'ai_verified', needs_clarification: true,
    policyResult: value.result, candidate_bound_verification: { status_id: 'confirmed' } };
  retainNonadoptedCurrentPolicyReview(prepared.token, candidate);
  const result = publishCurrentPolicyReviewFrame(candidate, { ...candidate });
  const held = holdCurrentPolicyReviewFrame(result, value.item);
  return { ...value, candidate, published: result, held, frame: projectCurrentPolicyReviewFrame(held) };
}
