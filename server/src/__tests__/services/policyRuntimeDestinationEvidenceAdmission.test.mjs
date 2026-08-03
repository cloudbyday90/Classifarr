/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS,
  buildPolicyRuntimeDestinationEvidenceCandidate,
} from '../../services/policyRuntimeDestinationEvidenceCandidate.mjs';
import {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS,
  buildPolicyRuntimeDestinationEvidenceAdmission,
} from '../../services/policyRuntimeDestinationEvidenceAdmission.mjs';
import {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS,
  buildPolicyRuntimeDestinationEvidenceProvenance,
} from '../../services/policyRuntimeDestinationEvidenceProvenance.mjs';
import {
  buildRuntimeDestinationEvidenceCommand,
} from '../../services/policyRuntimeDestinationEvidenceCommandService.mjs';

const now = Date.parse('2026-08-03T12:00:00.000Z');
const fingerprint = 'a'.repeat(22);

function nativeRule(overrides = {}) {
  return {
    intent_id: '33',
    policy_id: '18',
    intent_role: 'purpose',
    signal_type: 'studios',
    operator: 'require_any',
    values: { require_any: ['Studio Ghibli'] },
    semantics: 'identity',
    ...overrides,
  };
}

function executionState(overrides = {}) {
  return {
    ok: true,
    classification: {
      id: '42',
      metadata: {
        production_companies: [{ name: 'Studio Ghibli' }],
        overview: 'Text that must not become evidence.',
      },
    },
    destination: { id: '8', name: 'Anime Movies', mediaType: 'movie', active: true },
    resolution: { contractFingerprint: fingerprint, finalOutcomeRecorded: true },
    currentState: { locked: true },
    ...overrides,
  };
}

function currentProfile(overrides = {}) {
  return {
    library_id: '8',
    item_count: 20,
    studio_distribution: { 'Studio Ghibli': 80 },
    last_generated_at: '2026-08-03T11:00:00.000Z',
    updated_at: '2026-08-03T11:00:00.000Z',
    ...overrides,
  };
}

async function buildProvenance(overrides = {}) {
  return buildPolicyRuntimeDestinationEvidenceProvenance({
    client: { query: async () => ({ rows: [] }) },
    executionState: executionState(overrides.executionState),
    now,
    listRules: async () => overrides.nativeRules || [nativeRule()],
    getProfile: async () => overrides.profile || currentProfile(),
  });
}

describe('policyRuntimeDestinationEvidenceCandidate', () => {
  test('derives one identity candidate only from matching native rules and structured metadata', () => {
    const result = buildPolicyRuntimeDestinationEvidenceCandidate({
      classification: executionState().classification,
      destination: executionState().destination,
      nativeRules: [nativeRule()],
    });

    expect(result).toMatchObject({
      ok: true,
      candidate: {
        key: 'studio:studio_ghibli',
        signalType: 'studio',
        tierId: 'identity_evidence',
        evidenceCount: 2,
        evidenceSource: 'locked_native_intent_and_structured_metadata',
      },
      sideEffects: {
        providerLookupPerformed: false,
        providerQuotaRead: false,
        aiTextRead: false,
        ragEvidenceRead: false,
      },
    });
  });

  test('blocks broad genre and ambiguous native intersections instead of choosing a candidate', () => {
    const broad = buildPolicyRuntimeDestinationEvidenceCandidate({
      classification: { metadata: { genres: ['Animation'] } },
      destination: executionState().destination,
      nativeRules: [nativeRule({
        signal_type: 'genres',
        values: { require_any: ['Animation'] },
      })],
    });
    const ambiguous = buildPolicyRuntimeDestinationEvidenceCandidate({
      classification: { metadata: { production_companies: [{ name: 'Studio Ghibli' }, { name: 'Toei' }] } },
      destination: executionState().destination,
      nativeRules: [
        nativeRule(),
        nativeRule({ values: { require_any: ['Toei'] } }),
      ],
    });

    expect(broad).toMatchObject({ ok: false, candidate: null });
    expect(broad.reasonCodes).toContain(
      POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.BROAD_GENRE_BLOCKED,
    );
    expect(ambiguous).toMatchObject({ ok: false, candidateCount: 2, candidate: null });
    expect(ambiguous.reasonCodes).toContain(
      POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.AMBIGUOUS_CANDIDATE,
    );
  });
});

describe('policyRuntimeDestinationEvidenceAdmission', () => {
  test('requires a current profile and bounded intent before it admits receipt-backed identity evidence', async () => {
    const provenance = await buildProvenance();
    const admission = buildPolicyRuntimeDestinationEvidenceAdmission({
      executionState: executionState(),
      provenance,
      actorId: 'operator-7',
    });

    expect(provenance).toMatchObject({
      ok: true,
      statusId: 'ready',
      candidate: { key: 'studio:studio_ghibli', tierId: 'identity_evidence' },
      boundedIntentResult: {
        ok: true,
        evidenceFingerprintAudit: { ok: true },
      },
    });
    expect(admission).toMatchObject({
      ok: true,
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.READY,
      intake: {
        sourceId: 'operator_confirmation',
        actorId: 'operator-7',
        answerOutcomeId: 'add_identity_evidence',
      },
      decision: {
        learning: { decisionId: 'candidate', tierId: 'identity_evidence' },
        profileRefresh: { queue: true },
      },
      audit: { ok: true },
    });
    expect(admission.intake.sourceEventId).toMatch(
      /^runtime_destination_evidence:42:a{22}:[A-Za-z0-9_-]{22}$/,
    );
  });

  test('admits a native certification hint as compatibility evidence when declared identity remains bounded', async () => {
    const state = executionState({
      classification: {
        id: '42',
        metadata: {
          certification: 'PG-13',
          overview: 'Text that must not become evidence.',
        },
      },
    });
    const provenance = await buildProvenance({
      executionState: state,
      nativeRules: [
        nativeRule(),
        nativeRule({
          intent_role: 'helpful_hint',
          signal_type: 'certifications',
          values: { require_any: ['PG-13'] },
          semantics: 'compatibility',
        }),
      ],
      profile: currentProfile({ rating_distribution: { 'PG-13': 80 } }),
    });
    const admission = buildPolicyRuntimeDestinationEvidenceAdmission({
      executionState: state,
      provenance,
      actorId: 'operator-7',
    });

    expect(provenance).toMatchObject({
      ok: true,
      candidate: {
        key: 'certification:pg-13',
        tierId: 'compatibility_evidence',
      },
    });
    expect(admission).toMatchObject({
      ok: true,
      intake: { answerOutcomeId: 'add_compatibility_evidence' },
      decision: {
        learning: { tierId: 'compatibility_evidence' },
        profileRefresh: { queue: true },
      },
      audit: { ok: true },
    });
  });

  test('returns a no-op admission when the profile is stale', async () => {
    const provenance = await buildProvenance({
      profile: currentProfile({ last_generated_at: '2026-07-01T00:00:00.000Z' }),
    });
    const admission = buildPolicyRuntimeDestinationEvidenceAdmission({
      executionState: executionState(),
      provenance,
      actorId: 'operator-7',
    });

    expect(provenance).toMatchObject({ ok: false, statusId: 'blocked' });
    expect(provenance.reasonCodes).toContain(
      POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.PROFILE_STALE,
    );
    expect(admission).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED,
    });
  });

  test('builds an allowlisted identity command that verifies the recorded outcome and queues refresh', async () => {
    const state = executionState();
    const provenance = await buildProvenance();
    const admission = buildPolicyRuntimeDestinationEvidenceAdmission({
      executionState: state,
      provenance,
      actorId: 'operator-7',
    });
    const command = buildRuntimeDestinationEvidenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: {
        actorTypeId: 'operator',
        actorId: 'operator-7',
        revalidated: true,
        canRecordOutcome: true,
        canWriteLearning: true,
        authorizedSourceIds: ['operator_confirmation'],
      },
      currentState: {
        classificationId: '42',
        destinationLibraryId: '8',
        destinationLibraryName: 'Anime Movies',
        sourceEventId: admission.intake.sourceEventId,
        locked: true,
      },
    });

    expect(command).toMatchObject({
      ok: true,
      statusId: 'ready',
      operations: {
        finalOutcome: { operationId: 'verify_recorded_final_outcome' },
        learning: { operationId: 'write_identity_evidence' },
        profileRefresh: { operationId: 'queue_profile_refresh' },
      },
      audit: { ok: true },
    });
  });
});
