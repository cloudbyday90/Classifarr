/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyCohortCapture,
  HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS,
} from '../../services/heldOutSemanticStudyCohortCapture.mjs';

function id(prefix, index) {
  return `${prefix}_${index.toString(16).padStart(16, '0')}`;
}

function selected() {
  return Array.from({ length: 24 }, (_, index) => ({
    fixtureId: id('fixture', index),
    metadata: { media_type: 'movie', title: `Private title ${index}`, tmdb_id: index + 1 },
    snapshotId: id('snapshot', index),
    stratum: ['documentary', 'genre-overlap', 'ordinary', 'reality'][index % 4],
  }));
}

function snapshotDocument() {
  return {
    retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v3',
    snapshotSetId: id('snapshot_set', 1),
    snapshots: selected().map((entry) => ({
      alternativeRelevance: 20,
      candidateCount: 2,
      fixtureId: entry.fixtureId,
      id: entry.snapshotId,
      leadingRelevance: 80,
      retrievalStatusId: 'available',
      version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
    })),
    studyProvenance: {
      configurationFingerprint: `sha256:${'a'.repeat(64)}`,
      excludedIdentityCount: 24,
      exclusionSetFingerprint: `sha256:${'b'.repeat(64)}`,
      protocolVersion: 'policy.held_out_semantic_study.v1',
    },
    version: 'policy.candidate_current_inventory_semantic_study_snapshot_document.v2',
  };
}

function receipt() {
  return {
    automaticRoutingEligibility: false,
    caseCount: 24,
    eligibleByStratum: {},
    independentLabelsAvailable: false,
    policyChangeEligibility: false,
    selectedByStratum: {},
    selectionCommitment: `sha256:${'c'.repeat(64)}`,
    semanticSelection: false,
    statusId: 'captured_pending_independent_labels',
    version: 'policy.held_out_semantic_study_cohort_planner.v1',
  };
}

test('returns only the redacted bundle and receipt after a stable prospective capture', async () => {
  const planner = { plan: jest.fn(async () => ({
    receipt: receipt(),
    request: { cases: selected(), snapshotSetId: id('snapshot_set', 1) },
    selected: selected(),
  })) };
  const capture = { capture: jest.fn(async () => ({ status: { id: 'complete' }, document: snapshotDocument() })) };
  const preparation = { loadPolicies: jest.fn(async () => [{ library_id: 1 }]) };
  const service = createHeldOutSemanticStudyCohortCapture({
    capture,
    loadCandidates: jest.fn(async () => []),
    planner,
    preparation,
    random: () => Buffer.alloc(32, 1),
    readConfig: async () => ({ embedding_model: 'local' }),
  });

  const result = await service.capture({ caseCount: 24 });

  expect(result.status.id).toBe(HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURED_PENDING_INDEPENDENT_LABELS);
  expect(result.bundle.fixtureDocument).toHaveLength(24);
  expect(result.bundle.fixtureDocument.every((fixture) => fixture.tags.includes('broad-policy'))).toBe(true);
  expect(JSON.stringify(result)).not.toContain('Private title');
  expect(capture.capture).toHaveBeenCalledTimes(1);
});

test('exposes private case context only to the explicit reviewer-packet builder', async () => {
  const privateReviewCases = selected().map((entry) => ({
    contract: { candidates: [{ libraryId: 1 }, { libraryId: 2 }], valid: true },
    fixtureId: entry.fixtureId,
    metadata: entry.metadata,
  }));
  const capture = {
    captureForPrivateReviewerPacket: jest.fn(async () => ({
      document: snapshotDocument(),
      privateReviewCases,
      status: { id: 'complete' },
    })),
  };
  const planner = { plan: jest.fn(async () => ({
    receipt: receipt(),
    request: { cases: selected(), snapshotSetId: id('snapshot_set', 1) },
    selected: selected(),
  })) };
  const preparation = { loadPolicies: jest.fn(async () => [{ library_id: 1 }]) };
  const buildPacket = jest.fn(() => ({ packetId: `review_packet_${'a'.repeat(64)}` }));
  const buildScoringInput = jest.fn(() => ({ version: 'private-scoring-input' }));
  const service = createHeldOutSemanticStudyCohortCapture({
    capture,
    loadCandidates: jest.fn(async () => []),
    planner,
    preparation,
    random: () => Buffer.alloc(32, 1),
    readConfig: async () => ({ embedding_model: 'local' }),
  });

  const result = await service.captureForPrivateReviewerPacket({ buildPacket, buildScoringInput });

  expect(result.status.id).toBe('captured_pending_independent_labels');
  expect(result.reviewerPacket.packetId).toMatch(/^review_packet_/u);
  expect(result.scoringInput).toEqual({ version: 'private-scoring-input' });
  expect(capture.captureForPrivateReviewerPacket).toHaveBeenCalledTimes(1);
  expect(buildPacket).toHaveBeenCalledWith(expect.objectContaining({
    privateReviewCases: expect.arrayContaining([
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'Private title 0' }) }),
    ]),
  }));
  expect(buildScoringInput).toHaveBeenCalledWith(expect.objectContaining({
    privateReviewCases: expect.arrayContaining([
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'Private title 0' }) }),
    ]),
  }));
  expect(JSON.stringify(result.bundle)).not.toContain('Private title');
});

test('fails closed when configuration changes between planning and capture', async () => {
  let read = 0;
  const service = createHeldOutSemanticStudyCohortCapture({
    capture: { capture: jest.fn() },
    loadCandidates: jest.fn(async () => []),
    planner: { plan: jest.fn(async () => ({ receipt: receipt(), request: {}, selected: [] })) },
    preparation: { loadPolicies: jest.fn(async () => [{ library_id: 1 }]) },
    random: () => Buffer.alloc(32, 1),
    readConfig: async () => ({ embedding_model: ++read === 1 ? 'before' : 'after' }),
  });

  const result = await service.capture();

  expect(result.status.id).toBe(HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CONFIGURATION_CHANGED);
});
