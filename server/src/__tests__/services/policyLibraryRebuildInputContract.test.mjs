import {
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
} from '../../services/policyGuardedOutcomeProjection.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS,
  POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS,
  buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection,
  buildPolicyLibraryRebuildInputFromRuntimeInput,
  buildPolicyLibraryRebuildInputSummary,
  validatePolicyLibraryRebuildInputContract,
} from '../../services/policyLibraryRebuildInputContract.mjs';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

function profile(overrides = {}) {
  return {
    library_id: 6,
    item_count: 10,
    genre_distribution: { Animation: 80 },
    rating_distribution: { PG: 70 },
    last_generated_at: '2026-07-09T12:00:00.000Z',
    ...overrides,
  };
}

async function profileHandoff(overrides = {}) {
  return loadPolicyLibraryProfileEvidence({
    libraryId: 6,
    getProfile: async () => profile(overrides),
    now: NOW,
  });
}

function baseInput(profileEvidenceHandoff) {
  return {
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileEvidenceHandoff,
    operatorIntent: {
      belongsHere: [{ key: 'studio:disney', label: 'Disney', count: 7 }],
      helpfulMatches: [{ key: 'studio:pixar', label: 'Pixar', count: 3 }],
    },
    existingConstraints: {
      hardLimits: [{ key: 'rating:r', label: 'R rating' }],
      avoid: [{ key: 'genre:horror', label: 'Horror' }],
      askWhen: [{ key: 'certification:unknown', label: 'Unknown certification' }],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrType: 'radarr',
      arrConfigId: 1,
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
  };
}

describe('policyLibraryRebuildInputContract', () => {
  test('admits only a verified cached profile handoff and a valid guarded-outcome projection', async () => {
    const handoff = await profileHandoff();
    const guardedOutcomeProjection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [],
    });
    const contract = buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection({
      ...baseInput(handoff),
      guardedOutcomeProjection,
    });

    expect(contract).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS.READY,
      library: expect.objectContaining({ libraryId: 6 }),
      profileFreshness: expect.objectContaining({ stale: false }),
      guardedOutcomeProjection,
      sideEffects: {
        libraryProfileRead: false,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    }));
    expect(contract.libraryProfile.identityCandidates).toEqual([]);
    expect(contract.operatorIntent.belongsHere).toEqual([
      expect.objectContaining({ key: 'studio:disney', label: 'Disney' }),
    ]);
    expect(contract.existingConstraints.hardLimits).toEqual([
      expect.objectContaining({ key: 'rating:r' }),
    ]);
    expect(buildPolicyLibraryRebuildInputSummary(contract)).toEqual(expect.objectContaining({
      libraryId: 6,
      profile: expect.objectContaining({ libraryId: 6, stale: false }),
      guardedOutcomes: expect.objectContaining({ count: 0, acceptedCount: 0 }),
    }));
    expect(validatePolicyLibraryRebuildInputContract(contract)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects raw profile, freshness, absence, learning, and mixed projection inputs', async () => {
    const handoff = await profileHandoff();
    const input = baseInput(handoff);
    const guardedOutcomeProjection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [],
    });

    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      guardedOutcomes: [],
      libraryProfile: {},
    })).toThrow('does not accept "libraryProfile"');
    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      guardedOutcomes: [],
      profileFreshness: { stale: false },
    })).toThrow('does not accept "profileFreshness"');
    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      guardedOutcomes: [],
      observedAbsences: [],
    })).toThrow('does not accept "observedAbsences"');
    expect(() => buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection({
      ...input,
      guardedOutcomeProjection,
      learningDecision: {},
    })).toThrow('does not accept "learningDecision"');
    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      guardedOutcomes: [],
      guardedOutcomeProjection,
    })).toThrow('does not accept "guardedOutcomeProjection"');
  });

  test('rejects missing, mismatched, and unaudited profile handoffs before proposal composition', async () => {
    const handoff = await profileHandoff();
    const input = baseInput(handoff);

    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      profileHandoff: null,
      guardedOutcomes: [],
    })).toThrow('requires a cached profile handoff');
    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      library: { ...input.library, libraryId: 7 },
      guardedOutcomes: [],
    })).toThrow('requires a successful profile handoff for the selected library');
    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...input,
      profileHandoff: {
        ...handoff,
        profileEvidenceAudit: { ok: false },
      },
      guardedOutcomes: [],
    })).toThrow('requires verified bounded library profile evidence');
  });

  test('preserves stale profile status from the verified handoff without issuing a refresh', async () => {
    const handoff = await profileHandoff({
      last_generated_at: '2026-06-01T12:00:00.000Z',
    });
    const contract = buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...baseInput(handoff),
      guardedOutcomes: [],
    });

    expect(contract.profileFreshness).toEqual(expect.objectContaining({
      stale: true,
      reasonCode: 'stale_profile_timestamp',
    }));
    expect(contract.sourceSummary.profile).toEqual(expect.objectContaining({
      stale: true,
      statusId: 'ready_with_stale_profile',
    }));
    expect(contract.sideEffects.liveMediaServerLookupPerformed).toBe(false);
    expect(contract.sideEffects.providerQuotaRead).toBe(false);
  });

  test('preserves a validated strict-constraint descriptor across the rebuild evidence handoff', async () => {
    const handoff = await profileHandoff();
    const contract = buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...baseInput(handoff),
      existingConstraints: {
        ...baseInput(handoff).existingConstraints,
        hardLimits: [{
          key: 'certification:pg-13',
          label: 'PG-13 maximum',
          strictConstraint: {
            version: 'policy.strict_constraint_descriptor.v1',
            signal_type: 'certifications',
            operator: 'max',
            values: { mode: 'max', max: 'PG-13' },
            constraint_mode: 'strict',
            semantics: 'compatibility',
          },
        }],
      },
      guardedOutcomes: [],
    });

    expect(contract.existingConstraints.hardLimits).toEqual([
      expect.objectContaining({
        strictConstraint: expect.objectContaining({
          signal_type: 'certifications',
          operator: 'max',
          values: { mode: 'max', max: 'PG-13' },
        }),
      }),
    ]);
    expect(contract.evidenceInput.operatorIntent.hardLimits).toEqual(
      contract.existingConstraints.hardLimits
    );
  });

  test('rejects malformed strict-constraint descriptors before rebuild proposal composition', async () => {
    const handoff = await profileHandoff();

    expect(() => buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...baseInput(handoff),
      existingConstraints: {
        ...baseInput(handoff).existingConstraints,
        hardLimits: [{
          key: 'certification:pg-13',
          label: 'PG-13 maximum',
          strictConstraint: {
            version: 'policy.strict_constraint_descriptor.v1',
            signal_type: 'certifications',
            operator: 'include',
            values: { mode: 'max', max: 'PG-13' },
            constraint_mode: 'strict',
            semantics: 'compatibility',
          },
        }],
      },
      guardedOutcomes: [],
    })).toThrow('strict-constraint descriptor');
  });

  test('detects tampered contract summaries and side-effect claims', async () => {
    const handoff = await profileHandoff();
    const contract = buildPolicyLibraryRebuildInputFromRuntimeInput({
      ...baseInput(handoff),
      guardedOutcomes: [],
    });
    contract.sourceSummary.guardedOutcomes.acceptedCount = 1;
    contract.sideEffects.policyStorageMutated = true;

    const audit = validatePolicyLibraryRebuildInputContract(contract);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.SOURCE_SUMMARY_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
    ]));
  });
});
