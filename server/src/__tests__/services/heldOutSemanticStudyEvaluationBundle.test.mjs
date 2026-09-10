/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyBundle,
} from '../../services/heldOutSemanticStudyBundle.mjs';
import {
  buildHeldOutSemanticStudyEvaluationBundle,
  HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION,
} from '../../services/heldOutSemanticStudyEvaluationBundle.mjs';

function id(prefix, index) {
  return `${prefix}_${index.toString(16).padStart(16, '0')}`;
}

function selected() {
  return Array.from({ length: 24 }, (_, index) => ({
    fixtureId: id('fixture', index),
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

function packet(bundle) {
  return {
    cases: selected().map((entry, index) => ({
      candidates: [{ candidateId: 'candidate_a' }, { candidateId: 'candidate_b' }],
      fixtureId: entry.fixtureId,
      media: { overview: 'Private overview', title: `Private title ${index}` },
    })),
    fixtureDocumentFingerprint: bundle.manifest.fixtureDocumentFingerprint,
    instructions: { independence: 'Private reviewer instructions.' },
    packetId: `review_packet_${'a'.repeat(64)}`,
    studyWindow: {
      expiresAt: '2026-09-11T12:00:00.000Z',
      startsAt: '2026-09-10T12:00:00.000Z',
    },
    version: 'policy.held_out_semantic_study_reviewer_packet.v1',
  };
}

function input() {
  const bundle = buildHeldOutSemanticStudyBundle({
    selected: selected(),
    snapshotDocument: snapshotDocument(),
  });
  return { bundle, packet: packet(bundle) };
}

describe('held-out semantic-study evaluation bundle', () => {
  test('persists only a redacted, exact packet-bound semantic evidence bundle', () => {
    const result = buildHeldOutSemanticStudyEvaluationBundle(input());

    expect(result).toMatchObject({
      version: HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION,
      fixtureDocument: expect.any(Array),
      manifest: expect.any(Object),
      snapshotDocument: expect.any(Object),
    });
    expect(result.fixtureDocument).toHaveLength(24);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Private title');
    expect(JSON.stringify(result)).not.toContain('Private overview');
    expect(JSON.stringify(result)).not.toContain('candidates');
    expect(JSON.stringify(result)).not.toContain('media');
  });

  test.each(['fixture-set mismatch', 'manifest mismatch'])('fails closed on %s', (kind) => {
    const value = input();
    if (kind === 'fixture-set mismatch') value.packet.cases[0].fixtureId = id('fixture', 24);
    if (kind === 'manifest mismatch') {
      value.bundle = Object.freeze({
        ...value.bundle,
        manifest: Object.freeze({
          ...value.bundle.manifest,
          fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}`,
        }),
      });
    }

    expect(buildHeldOutSemanticStudyEvaluationBundle(value)).toBeNull();
  });
});
