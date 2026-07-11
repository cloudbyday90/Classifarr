import { jest } from '@jest/globals';
import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS,
  POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
  buildPolicyLibraryProfileEvidenceLoaderAudit,
  buildPolicyLibraryProfileFreshness,
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

function buildProfile(overrides = {}) {
  return {
    library_id: 42,
    item_count: 10,
    genre_distribution: { Animation: 80, Family: 50 },
    rating_distribution: { PG: 70 },
    last_generated_at: '2026-07-09T12:00:00.000Z',
    ...overrides,
  };
}

describe('policyLibraryProfileEvidenceLoader', () => {
  test('loads a persisted profile, adapts it, and hands bounded evidence to the evidence boundary', async () => {
    const getProfile = jest.fn().mockResolvedValue(buildProfile());

    const result = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile,
      now: NOW,
    });

    expect(getProfile).toHaveBeenCalledWith(42);
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY,
      libraryId: 42,
      profileFreshness: expect.objectContaining({
        stale: false,
        reasonCode: 'current_profile_timestamp',
      }),
      profileEvidenceAudit: expect.objectContaining({ ok: true }),
      evidenceBoundary: expect.objectContaining({ ok: true }),
      evidenceBoundaryAudit: expect.objectContaining({ ok: true }),
      sideEffects: {
        libraryProfileRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        evidenceProjectionBuilt: true,
        policyStorageMutated: false,
      },
    }));
    expect(result.profileEvidence.libraryProfile.identityCandidates).toEqual([]);
    expect(result.evidenceBoundary.projection.buckets.compatibility_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'Animation' }),
      ]));
    expect(buildPolicyLibraryProfileEvidenceLoaderAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('marks stale or unknown timestamps as review-required without triggering a refresh', async () => {
    const staleResult = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile: jest.fn().mockResolvedValue(buildProfile({
        last_generated_at: '2026-06-30T12:00:00.000Z',
      })),
      now: NOW,
    });
    const unknownFreshness = buildPolicyLibraryProfileFreshness({
      profile: buildProfile({ last_generated_at: null, updated_at: null }),
      now: NOW,
    });
    const unknownResult = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile: jest.fn().mockResolvedValue(buildProfile({
        last_generated_at: null,
        updated_at: null,
      })),
      now: NOW,
    });

    expect(staleResult).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY_WITH_STALE_PROFILE,
      profileFreshness: expect.objectContaining({
        stale: true,
        reasonCode: 'stale_profile_timestamp',
      }),
    }));
    expect(staleResult.evidenceBoundary.projection.buckets.insufficient_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ reasonCode: 'stale_profile' }),
      ]));
    expect(unknownFreshness).toEqual(expect.objectContaining({
      stale: true,
      updatedAt: null,
      ageMs: null,
      reasonCode: 'missing_profile_timestamp',
      maximumAgeMs: POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
    }));
    expect(unknownResult).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY_WITH_STALE_PROFILE,
      profileFreshness: expect.objectContaining({
        stale: true,
        reasonCode: 'missing_profile_timestamp',
      }),
    }));
  });

  test('fails closed for an invalid library ID, missing profile, or profile load failure', async () => {
    const invalid = await loadPolicyLibraryProfileEvidence({ libraryId: 'invalid' });
    const missing = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile: jest.fn().mockResolvedValue(null),
    });
    const failed = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile: jest.fn().mockRejectedValue(new Error('database details must not escape')),
    });

    expect(invalid).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(missing).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_NOT_FOUND,
    }));
    expect(failed).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_LOAD_FAILED,
    }));
    expect(JSON.stringify(failed)).not.toContain('database details must not escape');
  });

  test('uses a bounded custom freshness threshold and audits tampered results', async () => {
    const result = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      getProfile: jest.fn().mockResolvedValue(buildProfile()),
      now: NOW,
      maximumAgeMs: 1,
    });

    expect(result.statusId).toBe(POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY_WITH_STALE_PROFILE);
    result.statusId = POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY;
    result.sideEffects.liveProviderLookupPerformed = true;

    const audit = buildPolicyLibraryProfileEvidenceLoaderAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_BOUNDARY_AUDIT,
      POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });
});
