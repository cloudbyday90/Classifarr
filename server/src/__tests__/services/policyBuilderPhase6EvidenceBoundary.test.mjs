import {
  PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS,
  PHASE6R_EVIDENCE_BOUNDARY_VERSION,
  adaptPolicyBuilderPhase6EvidenceInput,
  buildPolicyBuilderPhase6BoundedEvidenceProjection,
} from '../../services/policyBuilderPhase6EvidenceBoundary.mjs';
import {
  PHASE6R_EVIDENCE_BUCKET_IDS,
  PHASE6R_EVIDENCE_SOURCE_IDS,
} from '../../services/policyBuilderPhase6EvidenceEngine.mjs';
import {
  PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS,
} from '../../services/policyBuilderPhase6EvidenceInputGate.mjs';
import {
  POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS,
  buildPolicyEvidenceFingerprint,
} from '../../services/policyEvidenceFingerprint.mjs';

describe('policyBuilderPhase6EvidenceBoundary', () => {
  test('adapts the public input envelope into the evidence projection shape', () => {
    const projectionInput = adaptPolicyBuilderPhase6EvidenceInput({
      libraryProfile: { identityCandidates: ['Animation'] },
      operatorIntent: { belongsHere: ['Animated Movies'] },
      classificationOutcomes: ['Mulan'],
      manualCorrections: ['Wrong library'],
      pendingItemAnswers: ['Needs confirmation'],
      arrRoutingOutcomes: ['Radarr routed'],
      metadataEvidence: ['Family'],
      profileFreshness: { stale: false },
    });

    expect(projectionInput).toEqual({
      libraryProfile: { identityCandidates: ['Animation'] },
      operatorIntent: { belongsHere: ['Animated Movies'] },
      classificationFinalOutcomes: ['Mulan'],
      manualCorrections: ['Wrong library'],
      pendingItemAnswers: ['Needs confirmation'],
      routingOutcomes: ['Radarr routed'],
      metadataEvidence: ['Family'],
      profileFreshness: { stale: false },
    });
  });

  test('gates, adapts, projects, and audits evidence without side effects', () => {
    const result = buildPolicyBuilderPhase6BoundedEvidenceProjection({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [
            { label: 'Animation', count: 12, confidence: 0.93 },
          ],
        },
        operatorIntent: {
          belongsHere: ['Animated Movies'],
          hardLimits: ['No NC-17'],
        },
        classificationOutcomes: ['Mulan'],
        arrRoutingOutcomes: ['Radarr accepted root folder'],
        metadataEvidence: ['Family'],
        profileFreshness: {
          stale: false,
          updatedAt: '2026-06-30T12:00:00.000Z',
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      version: PHASE6R_EVIDENCE_BOUNDARY_VERSION,
      ok: true,
      statusId: PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        evidenceProjectionBuilt: true,
        policyStorageMutated: false,
      },
      nextPhase: expect.objectContaining({
        phaseId: '6r_2',
      }),
    }));

    expect(result.inputGate.ok).toBe(true);
    expect(result.projectionAudit.ok).toBe(true);
    expect(result.projectionFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: expect.objectContaining({
        totalEntryCount: result.projection.summary.totalEntryCount,
        sourceIds: result.projection.summary.sourceIds,
        authoritySourceIds: result.projection.summary.authoritySourceIds,
      }),
    }));
    expect(JSON.stringify(result.projectionFingerprint)).not.toContain('Mulan');
    expect(JSON.stringify(result.projectionFingerprint)).not.toContain('Radarr accepted root folder');
    expect(result.projection.summary.sourceIds).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    ]));
    expect(result.projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
          label: 'Mulan',
        }),
      ]));
    expect(result.projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
          label: 'Radarr accepted root folder',
        }),
      ]));
  });

  test('blocks projection when input gate rejects unsafe payloads', () => {
    const result = buildPolicyBuilderPhase6BoundedEvidenceProjection({
      evidenceInput: {
        metadataEvidence: [{
          label: 'Provider evidence',
          providerPayload: { title: 'raw provider payload' },
          liveLookup: true,
        }],
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_GATE,
      projection: null,
      projectionAudit: null,
      projectionFingerprint: null,
      sideEffects: expect.objectContaining({
        evidenceProjectionBuilt: false,
        liveProviderLookupPerformed: false,
        policyStorageMutated: false,
      }),
    }));
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.RAW_PROVIDER_PAYLOAD,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.LIVE_PROVIDER_LOOKUP,
    ]));
    expect(JSON.stringify(result)).not.toContain('raw provider payload title');
  });

  test('blocks handoff when the projection fingerprint does not match the bounded projection', () => {
    const result = buildPolicyBuilderPhase6BoundedEvidenceProjection({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [{ label: 'Animation', count: 12 }],
        },
      },
      projectionFingerprintBuilder: projection => ({
        ...buildPolicyEvidenceFingerprint(projection),
        fingerprint: 'b'.repeat(64),
      }),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_FINGERPRINT,
      projectionAudit: expect.objectContaining({ ok: true }),
      projectionFingerprintAudit: expect.objectContaining({ ok: false }),
      nextPhase: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.FINGERPRINT_MISMATCH,
      }),
    ]));
  });
});
