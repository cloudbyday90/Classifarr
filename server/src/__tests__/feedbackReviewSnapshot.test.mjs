/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { readFeedbackOutcomeSnapshot } from '../services/feedbackOutcomeSnapshot.mjs';
import { feedbackSnapshotMatchesReceipt } from '../services/feedbackSelectionSnapshot.mjs';
import { normalizeFeedbackReviewCommand, feedbackReviewActorBinding } from '../services/feedbackReviewContract.mjs';
const snapshot = () => ({ version: 'classification.feedback_outcome.v3', classificationId: '9223372036854775807',
  mediaType: 'movie', tmdbId: 603, selectedLibraryId: 1, decisionContext: null, action: 'confirmation', intake: 'standalone',
  reference: { kind: 'original_automated_destination', libraryId: 1, reviewId: '2e851bf4-9497-4b99-8b7c-e8117a05c762',
    actorFingerprint: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), issuedAt: '2026-10-28T12:00:00.000Z', expiresAt: '2026-10-28T12:10:00.000Z' } });
const receipt = () => ({ classification_id: '9223372036854775807', intake: 'standalone', review_id: snapshot().reference.reviewId,
  review_actor_fingerprint: 'a'.repeat(64), observed_at: '2026-10-28T12:05:00.000Z' });
test('explicit feedback supports exact int64 identity without inventing an old int32 decision context', () => {
  const value = snapshot(); expect(readFeedbackOutcomeSnapshot(value)).toEqual(value)
  expect(feedbackSnapshotMatchesReceipt(value, receipt())).toBe(true)
});
test.each([
  value => { value.reference.kind = 'server_shortlist_at_commit'; },
  value => { value.action = 'selection'; },
  value => { value.intake = 'prompt'; },
  value => { value.selectedLibraryId = 2; },
  value => { value.classificationId = Number(value.classificationId); },
  value => { value.reference.expiresAt = '2026-10-28T12:11:00.000Z'; },
  value => { delete value.reference.sourceVersion; },
  value => { value.reference.actorFingerprint = 'not-proof'; },
  value => { value.decisionContext = {}; },
])('rejects malformed, implicit, misbound or wrong action evidence', mutate => {
  const value = snapshot(); mutate(value); expect(readFeedbackOutcomeSnapshot(value)).toBeNull();
});
test.each([
  value => { value.classification_id = '9223372036854775806'; },
  value => { value.intake = 'prompt'; },
  value => { value.review_id = '2e851bf4-9497-4b99-8b7c-e8117a05c763'; },
  value => { value.review_actor_fingerprint = 'c'.repeat(64); },
  value => { value.observed_at = '2026-10-28T11:59:59.999Z'; },
  value => { value.observed_at = '2026-10-28T12:10:00.001Z'; },
  value => { delete value.observed_at; },
])('requires an independent matching receipt within the issue/expiry window', mutate => {
  const value = receipt(); mutate(value); expect(feedbackSnapshotMatchesReceipt(readFeedbackOutcomeSnapshot(snapshot()), value)).toBe(false);
});
test('closed command binds action, actor incarnation and exact source identity', () => {
  const command = { reviewId: snapshot().reference.reviewId, action: 'confirmation', selected_library_id: 1, selected_policy_id: 2 };
  expect(normalizeFeedbackReviewCommand(snapshot().classificationId, command).input.classification_id).toBe(snapshot().classificationId);
  expect(() => normalizeFeedbackReviewCommand('7', { ...command, reference: 'client-invented' })).toThrow();
  expect(feedbackReviewActorBinding('account-v1', '7', command.reviewId)).not.toBe(feedbackReviewActorBinding('account-v2', '7', command.reviewId));
});
test.each(['source_library', 'manual_correction'])('rejects a contradictory original decision method %s', method => {
  const value = snapshot(); value.classificationId = '7';
  value.decisionContext = { classificationId: 7, capture: { version: 'classification.destination_decision.v1',
    mediaType: 'movie', tmdbId: 603, status: 'completed', libraryId: 1, method } };
  expect(readFeedbackOutcomeSnapshot(value)).toBeNull();
});
