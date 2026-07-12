import {
  MAX_EVIDENCE_RECORDS_PER_SECTION,
  POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_ENVELOPE_STATUS_IDS,
  buildPolicyEvidenceEnvelope,
  buildPolicyEvidenceEnvelopeAudit,
} from '../../services/policyEvidenceEnvelope.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
} from '../../services/policyEvidenceEngine.mjs';
import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

async function buildProfileHandoff(overrides = {}) {
  return loadPolicyLibraryProfileEvidence({
    libraryId: 42,
    now: NOW,
    getProfile: async () => ({
      library_id: 42,
      item_count: 10,
      genre_distribution: { Animation: 80 },
      last_generated_at: '2026-07-09T12:00:00.000Z',
      ...overrides,
    }),
  });
}

describe('policyEvidenceEnvelope', () => {
  test('combines bounded cached-profile evidence with persisted source snapshots', async () => {
    const profileHandoff = await buildProfileHandoff();
    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: ['No NC-17'],
      },
      classificationOutcomes: [{ label: 'Accepted final outcome', count: 2 }],
      manualCorrections: [{ label: 'Corrected destination', count: 1 }],
      pendingItemAnswers: [{ label: 'Needs learning review', count: 1 }],
      arrRoutingOutcomes: [{ label: 'Mapped Radarr route', count: 1 }],
      metadataEvidence: [{ label: 'Family support', confidence: 0.7 }],
    });

    expect(envelope).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.READY,
      profileHandoff: expect.objectContaining({ libraryId: 42 }),
      profileAudit: expect.objectContaining({ ok: true }),
      evidenceBoundary: expect.objectContaining({ ok: true }),
      evidenceBoundaryAudit: expect.objectContaining({ ok: true }),
      nextStep: expect.objectContaining({ stepId: 'intent_inference' }),
    }));
    expect(envelope.sourceSummary).toEqual({
      classificationOutcomes: { receivedCount: 1, acceptedCount: 1, truncated: false },
      manualCorrections: { receivedCount: 1, acceptedCount: 1, truncated: false },
      pendingItemAnswers: { receivedCount: 1, acceptedCount: 1, truncated: false },
      arrRoutingOutcomes: { receivedCount: 1, acceptedCount: 1, truncated: false },
      metadataEvidence: { receivedCount: 1, acceptedCount: 1, truncated: false },
    });
    expect(envelope.sourceProvenance).toEqual(expect.objectContaining({
      classificationOutcomes: {
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      },
      metadataEvidence: {
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      },
    }));
    expect(JSON.stringify(envelope.sourceSummary)).not.toContain('Accepted final outcome');
    expect(envelope.evidenceBoundary.projection.quality).toEqual(expect.objectContaining({
      hasDeclaredIdentityEvidence: true,
    }));
    expect(envelope.evidenceBoundary.projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Animated Movies',
        authoritySourceId: 'operator_declared_intent',
      }),
    ]));
    expect(buildPolicyEvidenceEnvelopeAudit(envelope)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('blocks when the cached-profile handoff is not ready', () => {
    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff: { ok: false, statusId: 'profile_not_found' },
    });

    expect(envelope).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_PROFILE,
      evidenceBoundary: null,
      nextStep: null,
    }));
    expect(buildPolicyEvidenceEnvelopeAudit(envelope).ok).toBe(true);
  });

  test('blocks unsafe source payloads at the evidence boundary without returning raw values', async () => {
    const profileHandoff = await buildProfileHandoff();
    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      metadataEvidence: [{
        label: 'Provider evidence',
        providerPayload: { title: 'raw title must not escape' },
      }],
    });

    expect(envelope).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      nextStep: null,
    }));
    expect(JSON.stringify(envelope)).not.toContain('raw title must not escape');
    expect(buildPolicyEvidenceEnvelopeAudit(envelope).ok).toBe(true);
  });

  test('validates declared operator intent at the shared evidence input gate', async () => {
    const profileHandoff = await buildProfileHandoff();
    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        providerPayload: { title: 'raw intent payload must not escape' },
      },
    });

    expect(envelope).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      nextStep: null,
    }));
    expect(JSON.stringify(envelope)).not.toContain('raw intent payload must not escape');
    expect(buildPolicyEvidenceEnvelopeAudit(envelope).ok).toBe(true);
  });

  test('bounds each source section and audits tampered summary, provenance, or side-effect data', async () => {
    const profileHandoff = await buildProfileHandoff();
    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      classificationOutcomes: Array.from({ length: MAX_EVIDENCE_RECORDS_PER_SECTION + 5 }, (_, index) => ({
        label: `Outcome ${index}`,
      })),
    });

    expect(envelope.sourceSummary.classificationOutcomes).toEqual({
      receivedCount: MAX_EVIDENCE_RECORDS_PER_SECTION + 5,
      acceptedCount: MAX_EVIDENCE_RECORDS_PER_SECTION,
      truncated: true,
    });

    envelope.sourceSummary.classificationOutcomes.acceptedCount = 999;
    envelope.sourceProvenance.metadataEvidence.authoritySourceId =
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT;
    envelope.sideEffects.liveProviderLookupPerformed = true;

    const audit = buildPolicyEvidenceEnvelopeAudit(envelope);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.SOURCE_PROVENANCE_MISMATCH,
      POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });
});
