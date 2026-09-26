/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { qualityReviewFixture, qualityTestSubmission } from '../fixtures/qualityReviewFixture.mjs';
import { qualityReviewContext } from '../../services/qualityReviewBinding.mjs';
import { createQualityReviewTemplate, finalizeQualityReviewSubmission } from '../../services/qualityReviewTemplates.mjs';
import { composeQualityReviewReference } from '../../services/qualityReviewConsensus.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { reportQualityEvidence } from '../../services/qualityEvidenceReport.mjs';
import { resolveIndependentReviewDecision } from '../../services/independentReviewDecision.mjs';

function pair(count) {
  const input = qualityReviewFixture(count);
  return { ...input, reviewerOne: qualityTestSubmission(input, 'reviewer-one'), reviewerTwo: qualityTestSubmission(input, 'reviewer-two') };
}
const otherTarget = (input, row) => input.protocol.destinations.find(target => target.mediaType === row.mediaType && target.target !== row.target).target;

test('300-case mixed media agreement produces existing synthetic reference contract without content or authority', () => {
  const input = pair(400), before = structuredClone(input), { reference, receipt } = composeQualityReviewReference(input);
  expect(receipt).toMatchObject({ status: 'complete', summary: { total: 300, resolved: 300, unanimous: 300, adjudicated: 0, missing: 0, disagreement: 0 },
    unresolved: [], limits: { providerCalls: 0, databaseWrites: 0, routingWrites: 0, independenceVerified: false, promotionAllowed: false } });
  expect(new Set(reference.labels.map(row => row.mediaType))).toEqual(new Set(['movie', 'tv']));
  expect(JSON.stringify({ reference, receipt })).not.toMatch(/PRIVATE|reviewer-one|reviewer-two|submissionId|description/);
  expect(reportQualityEvidence(emptyQualityEvidence(input.protocol), input.protocol, reference)).toMatchObject({ status: 'synthetic_only', provenance: 'synthetic_fixture.v1' });
  expect(input).toEqual(before);
});

test('blank primary judgments remain missing, not agreement or labels', () => {
  const input = pair(); input.reviewerOne.labels[0].target = null;
  input.reviewerOne.labels[1].target = null; input.reviewerTwo.labels[1].target = null;
  const { reference, receipt } = composeQualityReviewReference(input);
  expect(receipt).toMatchObject({ status: 'incomplete', summary: { total: 48, resolved: 46, missing: 2, disagreement: 0 } });
  expect(reference.labels).toHaveLength(46); expect(receipt.unresolved.every(row => row.reason === 'missing')).toBe(true);
  expect(() => createQualityReviewTemplate({ ...input, reviewerId: 'third' })).toThrow('quality_review_no_disputes');
});

test('third review sees only disputes, preserves abstention, and binds both primary submissions', () => {
  const input = pair(); input.reviewerTwo.labels[0].target = otherTarget(input, input.reviewerTwo.labels[0]);
  input.reviewerOne.labels[1].target = null;
  const template = createQualityReviewTemplate({ ...input, reviewerId: 'third' });
  expect(template.labels).toEqual([{ item: input.reviewerOne.labels[0].item, mediaType: input.reviewerOne.labels[0].mediaType, target: null }]);
  expect(JSON.stringify(template)).not.toContain(input.reviewerOne.labels[0].target);
  let adjudication = finalizeQualityReviewSubmission({ ...input, template });
  expect(composeQualityReviewReference({ ...input, adjudication }).receipt.summary).toMatchObject({ missing: 1, disagreement: 1, adjudicated: 0 });
  template.labels[0].target = input.reviewerOne.labels[0].target;
  adjudication = finalizeQualityReviewSubmission({ ...input, template });
  const result = composeQualityReviewReference({ ...input, adjudication });
  expect(result.receipt.summary).toMatchObject({ missing: 1, disagreement: 0, adjudicated: 1, resolved: 47 });
  expect(result.reference.labels[0]).toMatchObject({ consensus: 'adjudicated', reviewerCount: 3 });
  // Unrelated primary edits must still invalidate the pinned adjudication.
  input.reviewerOne.labels[2].target = null;
  expect(() => composeQualityReviewReference({ ...input, adjudication })).toThrow('quality_review_submission_invalid');
});

test('packet and label ordering are cosmetic; displayed text changes invalidate submissions', () => {
  const input = pair(), expected = composeQualityReviewReference(input);
  input.packet.cases.reverse(); input.packet.destinations.reverse(); input.reviewerOne.labels.reverse(); input.reviewerTwo.labels.reverse();
  expect(composeQualityReviewReference({ ...input, reviewerOne: input.reviewerTwo, reviewerTwo: input.reviewerOne })).toEqual(expected);
  input.packet.cases[0].description = 'changed context';
  expect(() => composeQualityReviewReference(input)).toThrow('quality_review_submission_invalid');
});

test.each([
  input => { input.reviewerTwo.reviewerId = input.reviewerOne.reviewerId; },
  input => { input.reviewerTwo.submissionId = input.reviewerOne.submissionId; },
])('duplicate reviewer or submission identities fail closed (%#)', mutate => {
  const input = pair(); mutate(input);
  expect(() => composeQualityReviewReference(input)).toThrow('quality_review_duplicate_reviewers');
});

test.each([
  row => { row.secret = 'PRIVATE'; }, row => { row.packetDigest = 'a'.repeat(64); },
  row => { row.protocolId = 'b'.repeat(64); }, row => { row.version = 'unknown'; },
  row => { row.reviewerId = 'UPPERCASE'; }, row => { row.submissionId = 'bad'; },
  row => { row.labels.push(row.labels[0]); }, row => { row.labels[1] = row.labels[0]; },
  row => { row.labels[0].mediaType = 'music'; }, row => { row.labels[0].target = 'unknown'; },
  row => { row.labels[0].private = 'PRIVATE'; }, row => { row.independentReviewConfirmed = true; },
  row => { row.parentReviews = 'a'.repeat(64); }, row => { row.createdAt = 'invalid'; },
  row => { row.submittedAt = '2026-09-25T11:59:00.000Z'; }, row => { row.submittedAt = '2026-09-25T12:01:00.000Z'; },
  row => { row.expiresAt = '2026-12-01T00:00:00.000Z'; }, row => { row.labels.pop(); },
])('malformed finalized submission is rejected (%#)', mutate => {
  const input = pair(); mutate(input.reviewerOne);
  expect(() => composeQualityReviewReference(input)).toThrow('quality_review_submission_invalid');
});

test('wrong-media destinations, altered protocol/packet membership, and empty cohorts are rejected', () => {
  const input = pair(); input.reviewerOne.labels[0].target = input.protocol.destinations.find(row => row.mediaType !== input.reviewerOne.labels[0].mediaType).target;
  expect(() => composeQualityReviewReference(input)).toThrow('quality_review_submission_invalid');
  input.packet.cases.pop(); expect(() => qualityReviewContext(input.protocol, input.packet)).toThrow('quality_review_binding_invalid');
  const empty = qualityReviewFixture(0); expect(() => qualityReviewContext(empty.protocol, empty.packet)).toThrow('quality_review_binding_invalid');
});

test('provenance and human attestation are explicit, never verified or inferred', () => {
  const input = qualityReviewFixture();
  expect(() => createQualityReviewTemplate({ ...input, reviewerId: 'one' })).toThrow('quality_review_template_invalid');
  const template = createQualityReviewTemplate({ ...input, reviewerId: 'one', provenance: 'independent_human.v1' });
  expect(template.labels.every(row => row.target === null)).toBe(true);
  expect(() => finalizeQualityReviewSubmission({ ...input, template })).toThrow('quality_review_attestation_required');
  template.independentReviewConfirmed = true;
  expect(finalizeQualityReviewSubmission({ ...input, template }).provenance).toBe('independent_human.v1');
  const reviewerOne = qualityTestSubmission(input, 'one', () => {}, 'independent_human.v1');
  const reviewerTwo = qualityTestSubmission(input, 'two', () => {}, 'independent_human.v1');
  expect(composeQualityReviewReference({ ...input, reviewerOne, reviewerTwo }).receipt.limits.independenceVerified).toBe(false);
  expect(() => composeQualityReviewReference({ ...input, reviewerOne, reviewerTwo: qualityTestSubmission(input, 'two') })).toThrow('quality_review_provenance_mismatch');
});

test('the original deadline is enforced for preparation/finalization but not historical composition', () => {
  const input = pair(), template = createQualityReviewTemplate({ ...qualityReviewFixture(), reviewerId: 'one', provenance: 'synthetic_fixture.v1' });
  for (const now of ['invalid', '2026-09-25T11:59:59.999Z', template.expiresAt]) {
    expect(() => createQualityReviewTemplate({ ...qualityReviewFixture(), reviewerId: 'one', provenance: 'synthetic_fixture.v1', now })).toThrow('quality_review_window_closed');
    expect(() => finalizeQualityReviewSubmission({ ...input, reviewerOne: null, reviewerTwo: null, template, now })).toThrow('quality_review_window_closed');
  }
  expect(composeQualityReviewReference({ ...input, now: '2026-12-01T00:00:00.000Z' }).receipt.status).toBe('complete');
  input.reviewerOne.submittedAt = template.expiresAt;
  expect(() => composeQualityReviewReference({ ...input, now: '2026-12-01T00:00:00.000Z' })).toThrow('quality_review_submission_invalid');
});

test('adjudication cannot reuse a primary identity, mix provenance, or override agreement', () => {
  const input = pair();
  expect(() => composeQualityReviewReference({ ...input, adjudication: input.reviewerOne })).toThrow('quality_review_no_disputes');
  input.reviewerTwo.labels[0].target = otherTarget(input, input.reviewerTwo.labels[0]);
  expect(() => createQualityReviewTemplate({ ...input, reviewerId: input.reviewerOne.reviewerId })).toThrow('quality_review_duplicate_reviewers');
  expect(() => createQualityReviewTemplate({ ...input, reviewerId: 'third', provenance: 'independent_human.v1' })).toThrow('quality_review_template_invalid');
  const template = createQualityReviewTemplate({ ...input, reviewerId: 'third' });
  template.labels[0].target = input.reviewerOne.labels[0].target;
  const adjudication = finalizeQualityReviewSubmission({ ...input, template });
  adjudication.provenance = 'independent_human.v1'; adjudication.independentReviewConfirmed = true;
  expect(() => composeQualityReviewReference({ ...input, adjudication })).toThrow('quality_review_provenance_mismatch');
});

test('invalid entropy, worksheet fields, and unbound adjudication fail before submission', () => {
  const input = qualityReviewFixture(), options = { ...input, reviewerId: 'one', provenance: 'synthetic_fixture.v1' };
  expect(() => createQualityReviewTemplate({ ...options, random: () => Buffer.alloc(1) })).toThrow('quality_review_template_invalid');
  const template = createQualityReviewTemplate(options); template.secret = 'PRIVATE';
  expect(() => finalizeQualityReviewSubmission({ ...input, template })).toThrow('quality_review_template_invalid');
  expect(resolveIndependentReviewDecision(undefined, undefined)).toBeNull();
});
