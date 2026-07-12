import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_INPUT_GATE_RISK_IDS,
  POLICY_EVIDENCE_INPUT_GATE_VERSION,
  POLICY_EVIDENCE_INPUT_SECTION_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceInputGate,
  buildPolicyEvidenceInputGateAudit,
  getPolicyEvidenceInputSection,
  listPolicyEvidenceInputSections,
  validatePolicyEvidenceInputSection,
} from '../../services/policyEvidenceInputGate.mjs';

describe('policyEvidenceInputGate', () => {
  test('defines safe input sections mapped to policy evidence sources and authority', () => {
    expect(listPolicyEvidenceInputSections().map(section => section.id)).toEqual([
      POLICY_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.CLASSIFICATION_OUTCOMES,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.MANUAL_CORRECTIONS,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.PENDING_ITEM_ANSWERS,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.ARR_ROUTING_OUTCOMES,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
      POLICY_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
    ]);

    expect(getPolicyEvidenceInputSection(
      POLICY_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE
    )).toEqual(expect.objectContaining({
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    }));
    expect(getPolicyEvidenceInputSection(
      POLICY_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT
    )).toEqual(expect.objectContaining({
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    }));
  });

  test('passes a clean bounded input envelope without side effects', () => {
    const gate = buildPolicyEvidenceInputGate({
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
      version: POLICY_EVIDENCE_INPUT_GATE_VERSION,
      ok: true,
      issueCount: 0,
      presentSections: [
        POLICY_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
        POLICY_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
        POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
        POLICY_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
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
    const gate = buildPolicyEvidenceInputGate({
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
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.RAW_PROVIDER_PAYLOAD,
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.LIVE_PROVIDER_LOOKUP,
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.TRANSIENT_PROVIDER_STATE,
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UI_DIAGNOSTIC_LANGUAGE,
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.REPLAY_OR_IMPACT_PAYLOAD,
    ]));
    expect(JSON.stringify(gate)).not.toContain('must-not-leak');
    expect(JSON.stringify(gate)).not.toContain('raw payload');
  });

  test('flags unknown top-level sections before projection consumes them', () => {
    const gate = buildPolicyEvidenceInputGate({
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
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION,
        sectionId: 'providerDiagnostics',
        path: 'providerDiagnostics',
      }),
    ]));
  });

  test('rejects inherited and accessor-backed values without reading them', () => {
    const inheritedEnvelope = Object.create({
      metadataEvidence: [{
        providerPayload: { apiKey: 'must-not-leak' },
      }],
    });
    const accessorEntry = {};
    const accessorArray = [];
    let accessorRead = false;
    let arrayAccessorRead = false;

    Object.defineProperty(accessorEntry, 'providerPayload', {
      enumerable: true,
      get() {
        accessorRead = true;
        return { apiKey: 'must-not-read' };
      },
    });
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get() {
        arrayAccessorRead = true;
        return { providerPayload: { apiKey: 'must-not-read' } };
      },
    });
    accessorArray.length = 1;

    const inheritedGate = buildPolicyEvidenceInputGate({
      evidenceInput: inheritedEnvelope,
    });
    const accessorGate = buildPolicyEvidenceInputGate({
      evidenceInput: {
        metadataEvidence: [accessorEntry],
      },
    });
    const arrayAccessorGate = buildPolicyEvidenceInputGate({
      evidenceInput: {
        metadataEvidence: accessorArray,
      },
    });

    expect(inheritedGate.ok).toBe(false);
    expect(inheritedGate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
      }),
    ]));
    expect(JSON.stringify(inheritedGate)).not.toContain('must-not-leak');

    expect(accessorGate.ok).toBe(false);
    expect(accessorGate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
        path: 'metadataEvidence.0.providerPayload',
      }),
    ]));
    expect(accessorRead).toBe(false);

    expect(arrayAccessorGate.ok).toBe(false);
    expect(arrayAccessorGate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
        path: 'metadataEvidence.0',
      }),
    ]));
    expect(arrayAccessorRead).toBe(false);
  });

  test('rejects own prototype-pollution keys before projection consumes them', () => {
    const metadataEntry = {};
    Object.defineProperty(metadataEntry, '__proto__', {
      enumerable: true,
      value: { providerPayload: { apiKey: 'must-not-leak' } },
    });

    const gate = buildPolicyEvidenceInputGate({
      evidenceInput: {
        metadataEvidence: [metadataEntry],
      },
    });

    expect(gate.ok).toBe(false);
    expect(gate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.PROTOTYPE_POLLUTION_KEY,
        path: 'metadataEvidence.0.__proto__',
      }),
    ]));
    expect(JSON.stringify(gate)).not.toContain('must-not-leak');
  });

  test('blocks oversized evidence collections after scanning only their bounded prefix', () => {
    const gate = buildPolicyEvidenceInputGate({
      evidenceInput: {
        metadataEvidence: Array.from({ length: 3 }, (_, index) => ({
          label: `Metadata ${index + 1}`,
        })),
      },
      maximumCollectionItems: 2,
    });

    expect(gate).toEqual(expect.objectContaining({
      ok: false,
      maximumCollectionItems: 2,
      collectionLimitCount: 1,
    }));
    expect(gate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.COLLECTION_LIMIT_EXCEEDED,
        sectionId: POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
        path: POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
        itemCount: 3,
        maximumItemCount: 2,
      }),
    ]));
  });

  test('passes the default input-gate audit', () => {
    const audit = buildPolicyEvidenceInputGateAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedSectionCount: 8,
      nextStep: expect.objectContaining({
        stepId: 'intent_inference',
      }),
    }));
  });

  test('rejects section contracts with unknown source or authority', () => {
    const result = validatePolicyEvidenceInputSection({
      id: 'unsafeSection',
      sourceId: 'unknown_source',
      authoritySourceId: 'unknown_authority',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_SOURCE,
      POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_AUTHORITY,
    ]));
  });

  test('rejects a known authority that is not permitted for the section source', () => {
    const result = validatePolicyEvidenceInputSection({
      id: POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      issues: [
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.SECTION_AUTHORITY_NOT_ALLOWED_FOR_SOURCE,
          sectionId: POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
          path: 'metadataEvidence.authoritySourceId',
        }),
      ],
    }));
  });
});
