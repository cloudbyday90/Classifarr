import { jest } from '@jest/globals';
import {
  createPolicyLibraryMetadataEvidenceCollector,
} from '../../services/policyLibraryMetadataEvidenceCollector.mjs';
import {
  createPolicyLibraryEvidenceLoader,
} from '../../services/policyLibraryEvidenceLoader.mjs';
import {
  createPolicyLibraryIntentProposalService,
  buildPolicyLibraryIntentProposalAudit,
  POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS,
  POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS,
} from '../../services/policyLibraryIntentProposalService.mjs';
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

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

function createReadyLibraryEvidenceLoader() {
  const outcomeCollector = createPolicyLibraryOutcomeEvidenceCollector({
    db: {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [] }),
    },
  });
  const pendingAnswerCollector = createPolicyLibraryPendingAnswerEvidenceCollector({
    db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  });
  const routingOutcomeCollector = createPolicyLibraryRoutingOutcomeEvidenceCollector({
    db: {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 1, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED }],
      }),
    },
  });
  const metadataCollector = createPolicyLibraryMetadataEvidenceCollector({
    db: {
      query: jest.fn().mockResolvedValue({
        rows: [{ genre_name: 'Animation', occurrence_count: 3 }],
      }),
    },
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

describe('policyLibraryIntentProposalService', () => {
  test('builds a provenance-preserving intent proposal from verified library evidence', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });

    const result = await service.proposeLibraryIntent({
      libraryId: 42,
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: ['No NC-17'],
      },
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.READY,
      handoffAudit: expect.objectContaining({
        ok: true,
        projectionFingerprint: expect.objectContaining({
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
      intentAudit: expect.objectContaining({ ok: true }),
      evidenceProvenance: expect.objectContaining({
        libraryId: 42,
        evidenceQuality: expect.objectContaining({ hasDeclaredIdentityEvidence: true }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
      intent: expect.objectContaining({
        source: 'policy_bounded_evidence_boundary',
        belongs_here: [expect.objectContaining({
          label: 'Animated Movies',
          operatorDeclared: true,
        })],
        hard_limits: [expect.objectContaining({ label: 'No NC-17' })],
      }),
      sideEffects: {
        libraryProfileRead: true,
        sourceDatabaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        intentDraftBuilt: true,
        policyStorageMutated: false,
      },
      nextStep: expect.objectContaining({ stepId: 'learning_eligibility' }),
    }));
    expect(JSON.stringify(result.evidenceProvenance)).not.toContain('Persisted metadata genre: Animation');
    expect(result.evidenceProvenance.projectionFingerprint.fingerprint)
      .toBe(result.handoffAudit.projectionFingerprint.fingerprint);
    expect(buildPolicyLibraryIntentProposalAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('blocks a structurally valid handoff that lacks declared or observed identity', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });

    const result = await service.proposeLibraryIntent({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_QUALITY_INSUFFICIENT,
      })],
      intent: null,
      nextStep: null,
    }));
    expect(buildPolicyLibraryIntentProposalAudit(result).ok).toBe(true);
  });

  test('rejects a ready proposal whose carried handoff audit no longer passes', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });
    const result = await service.proposeLibraryIntent({
      libraryId: 42,
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });
    result.handoffAudit.ok = false;

    expect(buildPolicyLibraryIntentProposalAudit(result).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_INVALID,
        }),
      ]));
  });

  test('rejects a ready proposal whose fingerprint differs from verified handoff provenance', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });
    const result = await service.proposeLibraryIntent({
      libraryId: 42,
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });
    result.evidenceProvenance.projectionFingerprint.fingerprint = '0'.repeat(64);

    expect(buildPolicyLibraryIntentProposalAudit(result).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('does not let a caller-supplied evidence boundary bypass library loading', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: createReadyLibraryEvidenceLoader(),
    });

    const result = await service.proposeLibraryIntent({
      libraryId: 42,
      evidenceBoundary: {
        ok: true,
        projection: { quality: { statusId: 'usable' } },
      },
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY,
      intent: null,
    }));
  });

  test('blocks a tampered evidence handoff before intent inference', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: {
        loadLibraryEvidence: jest.fn().mockResolvedValue({
          ok: true,
          statusId: 'ready',
          libraryId: 42,
          sideEffects: {},
          nextStep: { stepId: 'intent_inference' },
        }),
      },
    });

    const result = await service.proposeLibraryIntent({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_HANDOFF,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_INVALID,
      })],
      intent: null,
      nextStep: null,
    }));
  });

  test('sanitizes unexpected loader failures', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: {
        loadLibraryEvidence: jest.fn().mockRejectedValue(new Error('profile database details must not escape')),
      },
    });

    const result = await service.proposeLibraryIntent({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
      })],
    }));
    expect(JSON.stringify(result)).not.toContain('profile database details must not escape');
  });

  test('sanitizes unexpected handoff-audit failures', async () => {
    const service = createPolicyLibraryIntentProposalService({
      libraryEvidenceLoader: {
        loadLibraryEvidence: jest.fn().mockResolvedValue({ libraryId: 42 }),
      },
      buildHandoffAudit: jest.fn().mockImplementation(() => {
        throw new Error('audit implementation details must not escape');
      }),
    });

    const result = await service.proposeLibraryIntent({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
      })],
    }));
    expect(JSON.stringify(result)).not.toContain('audit implementation details must not escape');
  });
});
