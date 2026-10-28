/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { feedbackReviewId, feedbackReviewBody, normalizeFeedbackReviewCommand, feedbackReviewActorBinding,
  feedbackReviewHash, feedbackReviewUuid } from './feedbackReviewContract.mjs';
import { requireFeedbackReviewActor, readFeedbackReviewSource, readFeedbackReviewChoices,
  storeFeedbackReview, readFeedbackReview } from './feedbackReviewRepository.mjs';
import { projectFeedbackReviewSource, buildFeedbackReviewProjection, publicFeedbackReview } from './feedbackReviewProjection.mjs';
import { readFeedbackSourceReplay } from './feedbackSourceReceipt.mjs';
import { writeStandaloneFeedback } from './standaloneFeedbackWriter.mjs';
import { consumeFeedbackReview } from './feedbackReviewExecution.mjs';

const settings = client => client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='10s'; SET LOCAL TIME ZONE 'UTC'");
export function createFeedbackReviewService({ db, feedbackAnalysis }) {
  return {
    async prepare(actorId, rawClassId, body) {
      const classificationId = feedbackReviewId(rawClassId); feedbackReviewBody(body);
      return db.withTransaction(async client => {
        // Cap counts must see commits made while waiting for the shared preparation lock.
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await settings(client);
        await requireFeedbackReviewActor(client, actorId, true);
        if ((await client.query('SELECT 1 FROM policy_feedback_sources WHERE classification_id=$1', [classificationId])).rows.length) {
          throw new ConflictError('Feedback has already been recorded for this classification', { code: 'FEEDBACK_SOURCE_CONFLICT' });
        }
        const source = projectFeedbackReviewSource(await readFeedbackReviewSource(client, classificationId));
        const choices = await readFeedbackReviewChoices(client, source.item.mediaType);
        const projection = buildFeedbackReviewProjection(source, choices);
        return publicFeedbackReview(await storeFeedbackReview(client, actorId, classificationId, projection));
      });
    },
    async submit(actorId, rawClassId, body) {
      const command = normalizeFeedbackReviewCommand(rawClassId, body);
      return db.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await settings(client);
        const actor = await requireFeedbackReviewActor(client, actorId, true);
        const fingerprint = feedbackReviewHash(['feedback.review.command.v1', actor.key, command]);
        const replay = await readFeedbackSourceReplay(client, command.input.classification_id, fingerprint);
        if (replay) return { ...replay, reviewId: command.reviewId, classificationId: command.input.classification_id };
        const actorFingerprint = feedbackReviewActorBinding(actor.key, command.input.classification_id, command.reviewId);
        const prepared = await readFeedbackReview(client, actorId, command.input.classification_id, command.reviewId);
        const evidence = await consumeFeedbackReview(client, { actorId, command, prepared, actorFingerprint });
        const result = await writeStandaloneFeedback(client, { feedbackAnalysis, input: command.input, fingerprint, ...evidence });
        return { ...result, reviewId: command.reviewId, classificationId: command.input.classification_id };
      });
    },
    async receipt(actorId, rawClassId, reviewId) {
      const classificationId = feedbackReviewId(rawClassId);
      if (!feedbackReviewUuid(reviewId)) throw new ValidationError('Invalid feedback review reference');
      return db.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='5s'; SET LOCAL TIME ZONE 'UTC'");
        const actor = await requireFeedbackReviewActor(client, actorId);
        const row = (await client.query(`SELECT feedback_id,review_id::text,review_actor_fingerprint,created_at
          FROM policy_feedback_sources WHERE classification_id=$1`, [classificationId])).rows[0];
        const recorded = row?.review_id === reviewId && row.review_actor_fingerprint === feedbackReviewActorBinding(actor.key, classificationId, reviewId);
        return { version: 'feedback.review_receipt.v1', classificationId, reviewId, status: recorded ? 'recorded' : 'unverified',
          feedbackId: recorded ? row.feedback_id : null, recordedAt: recorded ? row.created_at.toISOString() : null };
      }, { signal: new AbortController().signal, readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 5000 });
    },
  };
}
