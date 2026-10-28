/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { feedbackReviewChanged } from './feedbackReviewContract.mjs';
import { projectFeedbackReviewSource } from './feedbackReviewProjection.mjs';
import { readFeedbackReview, readFeedbackReviewSource } from './feedbackReviewRepository.mjs';
import { buildFeedbackReviewOutcomeSnapshot } from './feedbackReviewOutcomeSnapshot.mjs';

export async function consumeFeedbackReview(client, { actorId, command, prepared, actorFingerprint }) {
  const { input, action, reviewId } = command, projection = prepared?.projection;
  if (!projection || !Array.isArray(projection.choices)) throw feedbackReviewChanged();
  const choice = projection.choices.find(value => value.policyId === input.selected_policy_id && value.libraryId === input.selected_library_id);
  if (!choice || (action === 'confirmation') !== (input.selected_library_id === projection.reference?.libraryId)) throw feedbackReviewChanged();
  const policy = (await client.query('SELECT id,library_id,xmin::text AS revision FROM library_policies WHERE id=$1 FOR UPDATE', [choice.policyId])).rows[0];
  const libraryIds = [...new Set([projection.reference.libraryId, choice.libraryId])].sort((a, b) => a - b);
  const libraries = (await client.query(`SELECT id,name,media_type,is_active,xmin::text AS revision
    FROM libraries WHERE id=ANY($1::integer[]) ORDER BY id FOR SHARE`, [libraryIds])).rows;
  const classification = await readFeedbackReviewSource(client, input.classification_id, true);
  const source = projectFeedbackReviewSource(classification);
  const current = await readFeedbackReview(client, actorId, input.classification_id, reviewId, true);
  if (!current || source.sourceVersion !== projection.sourceVersion ||
      JSON.stringify(current.projection) !== JSON.stringify(projection) || policy?.library_id !== choice.libraryId ||
      policy.revision !== choice.policyRevision || libraries.length !== libraryIds.length) throw feedbackReviewChanged();
  for (const library of libraries) {
    const expected = library.id === projection.reference.libraryId ? projection.reference : choice;
    if (!library.is_active || library.media_type !== source.item.mediaType || library.name !== expected.libraryName ||
        library.revision !== expected.libraryRevision) throw feedbackReviewChanged();
  }
  const consumed = await client.query(`DELETE FROM feedback_review_references
    WHERE id=$1 AND actor_id=$2 AND classification_id=$3 AND expires_at>clock_timestamp() RETURNING id`,
  [reviewId, actorId, input.classification_id]);
  if (consumed.rowCount !== 1) throw feedbackReviewChanged();
  const snapshot = buildFeedbackReviewOutcomeSnapshot(classification, choice.libraryId, action, current, actorFingerprint);
  if (!snapshot) throw feedbackReviewChanged();
  return { classification, reviewEvidence: { snapshot, reviewId, actorFingerprint } };
}
