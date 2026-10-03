/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { ROUTING_PLATFORMS } from './publishedRoutingSubject.mjs';
import { validateRoutingRehearsalEvidence } from './routingRehearsalEvidence.mjs';
import { parsePublishedImageReference, EXPECTED_RELEASE_REPOSITORY, EXPECTED_SIGNER_WORKFLOW,
  assertSourceRevision } from './publishedDigestConsumerSmoke.mjs';

export const PUBLISHED_ROUTING_SCHEMA = 'classifarr.release.published-routing.v1';

export function routingWorkflowIdentity(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.GITHUB_REPOSITORY, EXPECTED_RELEASE_REPOSITORY);
  assert.match(env.GITHUB_RUN_ID ?? '', /^[1-9][0-9]*$/);
  assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9][0-9]*$/);
  return { runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT };
}

export function validatePublishedRoutingReceipt(value, { image, sourceRevision, platform, workflow, now }) {
  const expectedImage = parsePublishedImageReference(image).image;
  assertSourceRevision(sourceRevision);
  assert.ok(ROUTING_PLATFORMS.includes(platform));
  assert.match(workflow?.runId ?? '', /^[1-9][0-9]*$/);
  assert.match(workflow?.runAttempt ?? '', /^[1-9][0-9]*$/);
  assert.match(value?.subject?.manifestDigest ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.match(value?.subject?.configDigest ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.ok([value.subject.manifestDigest, value.subject.configDigest].includes(value.subject.imageId));
  const completed = Date.parse(value?.completedAt), current = Date.parse(now);
  assert.ok(Number.isFinite(completed) && Number.isFinite(current));
  assert.equal(new Date(completed).toISOString(), value.completedAt);
  assert.ok(current - completed <= 6 * 60 * 60 * 1000 && completed - current <= 5 * 60 * 1000);
  const routing = validateRoutingRehearsalEvidence(value.routing, {
    candidateImageId: value.subject.imageId, sourceRevision,
  });
  const normalized = { schemaVersion: PUBLISHED_ROUTING_SCHEMA, status: 'passed',
    completedAt: value.completedAt, workflow: { runId: workflow.runId, runAttempt: workflow.runAttempt },
    subject: { image: expectedImage, platform, manifestDigest: value.subject.manifestDigest, configDigest: value.subject.configDigest,
      imageId: routing.candidateImageId, sourceRevision,
      provenance: { repository: EXPECTED_RELEASE_REPOSITORY, signerWorkflow: EXPECTED_SIGNER_WORKFLOW, verified: true } }, routing };
  assert.deepEqual(value, normalized);
  return normalized;
}

export function validatePublishedRoutingMatrix(receipts, expected) {
  assert.ok(Array.isArray(receipts));
  assert.equal(receipts.length, ROUTING_PLATFORMS.length);
  return ROUTING_PLATFORMS.map(platform => {
    const matching = receipts.filter(receipt => receipt?.subject?.platform === platform);
    assert.equal(matching.length, 1);
    return validatePublishedRoutingReceipt(matching[0], { ...expected, platform });
  });
}
