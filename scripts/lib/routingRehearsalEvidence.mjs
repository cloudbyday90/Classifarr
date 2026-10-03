/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { ROUTING_EXPECTED } from './manualRoutingRehearsal.mjs';
import { ROUTING_BASELINE } from './manualRoutingRehearsalDocker.mjs';

/** Validate against caller-owned identity; never let a receipt choose its subject. */
export function routingRehearsalEvidence(result, { candidateImageId, sourceRevision, baselineImageId = result?.baseline } = {}) {
  assert.match(candidateImageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.match(sourceRevision ?? '', /^[a-f0-9]{40,64}$/);
  assert.match(baselineImageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(baselineImageId, candidateImageId);
  assert.equal(result.status, 'passed');
  assert.equal(result.cleanup, 'passed');
  assert.equal(result.candidate, candidateImageId);
  assert.equal(result.baseline, baselineImageId);
  assert.deepEqual(result.checks, Object.keys(ROUTING_EXPECTED));
  for (const [key, value] of Object.entries(ROUTING_EXPECTED.complete)) assert.equal(result[key], value);
  return { schemaVersion: 'classifarr.routing-rehearsal.v1', status: 'passed', sourceRevision,
    candidateImageId, baseline: { revision: ROUTING_BASELINE, imageId: baselineImageId },
    checks: [...result.checks], ...ROUTING_EXPECTED.complete, cleanup: 'passed' };
}

export function validateRoutingRehearsalEvidence(value, expected) {
  const normalized = routingRehearsalEvidence({ ...value, candidate: value?.candidateImageId, baseline: value?.baseline?.imageId }, expected);
  assert.deepEqual(value, normalized);
  return normalized;
}
