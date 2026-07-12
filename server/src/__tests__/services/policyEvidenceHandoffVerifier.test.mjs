import { jest } from '@jest/globals';
import {
  createPolicyLibraryMetadataEvidenceCollector,
} from '../../services/policyLibraryMetadataEvidenceCollector.mjs';
import {
  createPolicyLibraryEvidenceLoader,
} from '../../services/policyLibraryEvidenceLoader.mjs';
import {
  createPolicyLibraryOutcomeEvidenceCollector,
} from '../../services/policyLibraryOutcomeEvidenceCollector.mjs';
import {
  createPolicyLibraryPendingAnswerEvidenceCollector,
} from '../../services/policyLibraryPendingAnswerEvidenceCollector.mjs';
import {
  createPolicyLibraryRoutingOutcomeEvidenceCollector,
  ROUTING_OUTCOME_STATE_IDS,
} from '../../services/policyLibraryRoutingOutcomeEvidenceCollector.mjs';
import {
  buildPolicyEvidenceHandoffAudit,
  createPolicyEvidenceHandoffVerifier,
  POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS,
  POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS,
} from '../../services/policyEvidenceHandoffVerifier.mjs';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

function createReadyLibraryEvidenceLoader() {
  const outcomeCollector = createPolicyLibraryOutcomeEvidenceCollector({
    db: {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, classification_id: 1, corrected_library_id: 42 }] }),
    },
  });
  const pendingAnswerCollector = createPolicyLibraryPendingAnswerEvidenceCollector({
    db: { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) },
  });
  const routingOutcomeCollector = createPolicyLibraryRoutingOutcomeEvidenceCollector({
    db: {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 1, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED }],
      }),
    },
  });
  const metadataCollector = createPolicyLibraryMetadataEvidenceCollector({
    db: { query: jest.fn().mockResolvedValue({ rows: [{ genre_name: 'Animation', occurrence_count: 3 }] }) },
  });

  return createPolicyLibraryEvidenceLoader({
    outcomeCollector,
    pendingAnswerCollector,
    routingOutcomeCollector,
    metadataCollector,
  });
}

function getCurrentProfile() {
  return {
    library_id: 42,
    item_count: 10,
    genre_distribution: { Animation: 80 },
    last_generated_at: '2026-07-09T12:00:00.000Z',
  };
}

describe('policyEvidenceHandoffVerifier', () => {
  test('verifies a complete audited handoff without exposing source record labels', async () => {
    const verifier = createPolicyEvidenceHandoffVerifier({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });

    const result = await verifier.verifyLibraryEvidenceHandoff({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.READY,
      audit: expect.objectContaining({
        ok: true,
        readyForIntent: true,
        projectionFingerprint: expect.objectContaining({
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
      handoff: expect.objectContaining({
        libraryId: 42,
        loaderStatusId: 'ready',
        envelopeStatusId: 'ready',
        boundaryStatusId: 'ready',
      }),
      nextStep: expect.objectContaining({ stepId: 'intent_inference' }),
    }));
    expect(JSON.stringify(result)).not.toContain('Persisted metadata genre: Animation');
    expect(JSON.stringify(result)).not.toContain('Persisted final classification outcome');
  });

  test('returns a structurally valid blocked result when library evidence is unavailable', async () => {
    const verifier = createPolicyEvidenceHandoffVerifier({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });

    const result = await verifier.verifyLibraryEvidenceHandoff({
      libraryId: 42,
      getProfile: async () => null,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.BLOCKED_BY_LIBRARY_EVIDENCE,
      issues: [expect.objectContaining({
        riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.HANDOFF_NOT_READY,
      })],
      nextStep: null,
      audit: expect.objectContaining({
        ok: true,
        readyForIntent: false,
      }),
    }));
  });

  test('detects tampered quality, fingerprint, and side-effect records', async () => {
    const loader = createReadyLibraryEvidenceLoader();
    const handoff = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });
    handoff.evidenceEnvelope.evidenceBoundary.projection.quality.statusId = 'tampered';
    handoff.evidenceEnvelope.evidenceBoundary.projectionFingerprint.fingerprint = '0'.repeat(64);
    handoff.sideEffects.liveProviderLookupPerformed = true;

    const audit = buildPolicyEvidenceHandoffAudit(handoff);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.FINGERPRINT_AUDIT_FAILED,
      POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.QUALITY_AUDIT_FAILED,
      POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });

  test('detects static engine contract failure independently of a ready handoff', async () => {
    const loader = createReadyLibraryEvidenceLoader();
    const handoff = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    const audit = buildPolicyEvidenceHandoffAudit(handoff, {
      buildEngineAudit: () => ({ ok: false, issueCount: 1, issues: [{ riskId: 'engine_rule_failed' }] }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.ENGINE_AUDIT_FAILED,
      }),
    ]));
  });

  test('revalidates the received projection instead of trusting its recorded boundary audit', async () => {
    const loader = createReadyLibraryEvidenceLoader();
    const handoff = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    const audit = buildPolicyEvidenceHandoffAudit(handoff, {
      buildProjectionAudit: () => ({
        ok: false,
        issueCount: 1,
        issues: [{ riskId: 'projection_structure_failed' }],
      }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.PROJECTION_AUDIT_FAILED,
      }),
    ]));
    expect(audit.projectionAudit).toEqual(expect.objectContaining({
      ok: false,
      riskIds: ['projection_structure_failed'],
    }));
  });

  test('sanitizes thrown loader failures', async () => {
    const verifier = createPolicyEvidenceHandoffVerifier({
      libraryEvidenceLoader: {
        loadLibraryEvidence: jest.fn().mockRejectedValue(new Error('database details must not escape')),
      },
    });

    const result = await verifier.verifyLibraryEvidenceHandoff({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.VERIFICATION_FAILED,
      issues: [expect.objectContaining({
        riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.VERIFICATION_FAILED,
      })],
    }));
    expect(JSON.stringify(result)).not.toContain('database details must not escape');
  });
});
