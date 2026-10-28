/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectPromptClassification } from './promptClassificationProjection.mjs';
import { recordFeedbackSource } from './feedbackSourceReceipt.mjs';

/** Existing feedback/statistics effects, shared by legacy selection and validated explicit review. */
export async function writeStandaloneFeedback(client, { feedbackAnalysis, input, classification, fingerprint, reviewEvidence = null }) {
  const { metadata, evaluation } = projectPromptClassification(classification);
  const candidate = evaluation.ranked[0], rawCandidateId = candidate?.library_id;
  const candidateId = typeof rawCandidateId === 'number' || typeof rawCandidateId === 'string' && /^[1-9]\d*$/.test(rawCandidateId)
    ? Number(rawCandidateId) : NaN;
  const originalId = Number.isInteger(candidateId) && candidateId > 0 && candidateId <= 2147483647 ? candidateId : null;
  const promptType = classification.method === 'policy_auto' ? 'auto_classify'
    : classification.method === 'ai_verified' ? 'ai_validate' : 'classification_feedback';
  const feedbackId = await feedbackAnalysis.recordFeedback({
    tmdb_id: classification.tmdb_id, media_type: classification.media_type, title: classification.title,
    item_metadata: metadata, original_scores: evaluation.scores, signal_analysis: evaluation.scores,
    prompt_type: promptType, top_suggestion_library_id: originalId,
    top_suggestion_score: originalId == null ? null : candidate?.score,
    selected_library_id: input.selected_library_id, selected_policy_id: input.selected_policy_id,
    was_correction: originalId == null ? null : originalId !== input.selected_library_id,
    user_reason: input.user_reason, user_reason_text: input.user_reason_text, source: 'web',
    prompted_at: classification.created_at, responded_at: new Date(),
  }, client);
  await recordFeedbackSource(client, { classificationId: input.classification_id, feedbackId, intake: 'standalone', fingerprint,
    classification, selectedLibraryId: input.selected_library_id, reviewEvidence });
  return { feedbackId, replayed: false };
}
