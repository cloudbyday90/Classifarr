import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  PHASE6R_EVIDENCE_SOURCE_IDS,
} from '../../services/policyBuilderPhase6EvidenceEngine.mjs';
import {
  PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS,
  PHASE6R_EVIDENCE_INPUT_GATE_VERSION,
  PHASE6R_EVIDENCE_INPUT_SECTION_IDS,
  buildPolicyBuilderPhase6EvidenceInputGate,
  buildPolicyBuilderPhase6EvidenceInputGateAudit,
  getPolicyBuilderPhase6EvidenceInputSection,
  listPolicyBuilderPhase6EvidenceInputSections,
  validatePolicyBuilderPhase6EvidenceInputSection,
} from '../../services/policyBuilderPhase6EvidenceInputGate.mjs';

describe('policyBuilderPhase6EvidenceInputGate', () => {
  test('defines safe input sections mapped to Phase 6R evidence sources and authority', () => {
    expect(listPolicyBuilderPhase6EvidenceInputSections().map(section => section.id)).toEqual([
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.CLASSIFICATION_OUTCOMES,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.MANUAL_CORRECTIONS,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.PENDING_ITEM_ANSWERS,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.ARR_ROUTING_OUTCOMES,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
    ]);

    expect(getPolicyBuilderPhase6EvidenceInputSection(
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE
    )).toEqual(expect.objectContaining({
      sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    }));
    expect(getPolicyBuilderPhase6EvidenceInputSection(
      PHASE6R_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT
    )).toEqual(expect.objectContaining({
      sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    }));
  });

  test('passes a clean bounded input envelope without side effects', () => {
    const gate = buildPolicyBuilderPhase6EvidenceInputGate({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [
            { label: 'Animation', count: 14, confidence: 0.91 },
          ],
        },
        operatorIntent: {
          belongsHere: ['Animated Movies'],
          hardLimits: ['No NC-17'],
        },
        metadataEvidence: [
          { label: 'TMDB genre: Animation', confidence: 0.8 },
        ],
        profileFreshness: {
          stale: false,
          observedAt: '2026-06-30T12:00:00.000Z',
        },
      },
    });

    expect(gate).toEqual(expect.objectContaining({
      version: PHASE6R_EVIDENCE_INPUT_GATE_VERSION,
      ok: true,
      issueCount: 0,
      presentSections: [
        PHASE6R_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
        PHASE6R_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
        PHASE6R_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
        PHASE6R_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
      ],
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        evidenceProjectionBuilt: false,
        policyStorageMutated: false,
      },
      issues: [],
    }));
  });

  test('flags raw payloads, live lookups, provider state, UI labels, and replay payloads', () => {
    const gate = buildPolicyBuilderPhase6EvidenceInputGate({
      evidenceInput: {
        metadataEvidence: [{
          label: 'Provider evidence',
          raw: { apiKey: 'must-not-leak' },
          providerPayload: { title: 'raw payload' },
          liveLookupPerformed: true,
          quotaState: { remaining: 1 },
          uiChipLabel: 'Provider chip',
          replayPreview: { score: 0.72 },
        }],
      },
    });

    expect(gate.ok).toBe(false);
    expect(gate.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.RAW_PROVIDER_PAYLOAD,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.LIVE_PROVIDER_LOOKUP,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.TRANSIENT_PROVIDER_STATE,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UI_DIAGNOSTIC_LANGUAGE,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.REPLAY_OR_IMPACT_PAYLOAD,
    ]));
    expect(JSON.stringify(gate)).not.toContain('must-not-leak');
    expect(JSON.stringify(gate)).not.toContain('raw payload');
  });

  test('flags unknown top-level sections before projection consumes them', () => {
    const gate = buildPolicyBuilderPhase6EvidenceInputGate({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: ['Animation'],
        },
        providerDiagnostics: {
          quotaState: 'ignored',
        },
      },
    });

    expect(gate.ok).toBe(false);
    expect(gate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION,
        sectionId: 'providerDiagnostics',
        path: 'providerDiagnostics',
      }),
    ]));
  });

  test('passes the default input-gate audit', () => {
    const audit = buildPolicyBuilderPhase6EvidenceInputGateAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedSectionCount: 8,
      nextPhase: expect.objectContaining({
        phaseId: '6r_2',
      }),
    }));
  });

  test('rejects section contracts with unknown source or authority', () => {
    const result = validatePolicyBuilderPhase6EvidenceInputSection({
      id: 'unsafeSection',
      sourceId: 'unknown_source',
      authoritySourceId: 'unknown_authority',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_SOURCE,
      PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_AUTHORITY,
    ]));
  });
});
