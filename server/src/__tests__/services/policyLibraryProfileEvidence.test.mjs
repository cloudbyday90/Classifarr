import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION,
  buildPolicyLibraryProfileEvidence,
  buildPolicyLibraryProfileEvidenceAudit,
} from '../../services/policyLibraryProfileEvidence.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';

describe('policyLibraryProfileEvidence', () => {
  test('adapts persisted media-server profile distributions into bounded compatibility evidence', () => {
    const evidence = buildPolicyLibraryProfileEvidence({
      item_count: 20,
      genre_distribution: {
        Animation: 80,
        Family: 55,
        Adventure: 35,
      },
      rating_distribution: JSON.stringify({ PG: 70, G: 30 }),
      studio_distribution: { Disney: 65 },
      keyword_distribution: { musical: 40 },
    });

    expect(evidence.version).toBe(POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION);
    expect(evidence.libraryProfile.identityCandidates).toEqual([]);
    expect(evidence.libraryProfile.compatibilityCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'genre:animation',
        label: 'Animation',
        value: '80%',
        count: 16,
        confidence: 0.8,
        reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_DISTRIBUTION,
      }),
      expect.objectContaining({
        key: 'rating:pg',
        label: 'PG',
      }),
      expect.objectContaining({
        key: 'studio:disney',
        label: 'Disney',
      }),
      expect.objectContaining({
        key: 'keyword:musical',
        label: 'musical',
      }),
    ]));
    expect(evidence.summary).toEqual({
      itemCount: 20,
      distributionSignalCount: 4,
      compatibilityCandidateCount: 7,
      observedAbsenceCount: 0,
    });
    expect(evidence.warnings).toEqual([]);
    expect(buildPolicyLibraryProfileEvidenceAudit(evidence)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('keeps observed absences review-only and never converts them to policy exclusions', () => {
    const evidence = buildPolicyLibraryProfileEvidence({
      itemCount: 4,
      genres: { Animation: 100 },
      exclusionRatings: ['NC-17', 'R'],
      exclusionGenres: ['Horror'],
    });

    expect(evidence.libraryProfile.outliers).toEqual([
      expect.objectContaining({
        key: 'rating:nc-17',
        label: 'No observed NC-17 rating entries',
        count: 0,
        reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_ABSENCE_REQUIRES_REVIEW,
      }),
      expect.objectContaining({
        key: 'rating:r',
        label: 'No observed R rating entries',
      }),
      expect.objectContaining({
        key: 'genre:horror',
        label: 'No observed Horror genre entries',
      }),
    ]);
    expect(evidence.libraryProfile).not.toHaveProperty('hardLimits');
    expect(evidence.libraryProfile).not.toHaveProperty('avoid');
    expect(buildPolicyLibraryProfileEvidenceAudit(evidence).ok).toBe(true);
  });

  test('is deterministic, bounded, and does not copy raw profile fields into the evidence contract', () => {
    const profile = {
      item_count: 10,
      genre_distribution: {
        Zeta: 10,
        Alpha: 10,
        Beta: 20,
        Gamma: 30,
        Delta: 40,
        Epsilon: 50,
        Eta: 60,
      },
      raw: { providerPayload: { title: 'must not escape' } },
      last_generated_at: '2026-07-01T00:00:00.000Z',
    };

    const first = buildPolicyLibraryProfileEvidence(profile);
    const second = buildPolicyLibraryProfileEvidence(profile);

    expect(first).toEqual(second);
    expect(first.libraryProfile.compatibilityCandidates).toHaveLength(5);
    expect(first.libraryProfile.compatibilityCandidates.map(candidate => candidate.label)).toEqual([
      'Eta',
      'Epsilon',
      'Delta',
      'Gamma',
      'Beta',
    ]);
    expect(JSON.stringify(first)).not.toContain('providerPayload');
    expect(JSON.stringify(first)).not.toContain('last_generated_at');
    expect(first.sideEffects).toEqual({
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
    });
  });

  test('warns when no usable observed distributions exist', () => {
    const evidence = buildPolicyLibraryProfileEvidence({
      genre_distribution: { Animation: 0, Invalid: 'not a percent' },
    });

    expect(evidence.libraryProfile).toEqual({
      identityCandidates: [],
      compatibilityCandidates: [],
      outliers: [],
    });
    expect(evidence.warnings).toEqual([{
      reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.MISSING_PROFILE_DISTRIBUTIONS,
    }]);
  });

  test('feeds bounded compatibility and review evidence through the server-owned evidence boundary', () => {
    const libraryEvidence = buildPolicyLibraryProfileEvidence({
      itemCount: 10,
      genres: { Animation: 80, Family: 50 },
      exclusionRatings: ['R'],
    });

    const result = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        libraryProfile: libraryEvidence.libraryProfile,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.projection.buckets.compatibility_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Animation' }),
      expect.objectContaining({ label: 'Family' }),
    ]));
    expect(result.projection.buckets.outlier_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'No observed R rating entries' }),
    ]));
    expect(result.projection.buckets.identity_evidence).toEqual([]);
  });

  test('fails closed when an adapted evidence result is tampered with', () => {
    const evidence = buildPolicyLibraryProfileEvidence({
      genres: { Animation: 100 },
    });
    evidence.libraryProfile.identityCandidates.push({ label: 'Animation' });
    evidence.libraryProfile.compatibilityCandidates[0].reasonCode = 'untrusted_reason';
    evidence.sideEffects.liveProviderLookupPerformed = true;

    const audit = buildPolicyLibraryProfileEvidenceAudit(evidence);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.IDENTITY_FROM_DISTRIBUTION,
      POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.INVALID_COMPATIBILITY_CANDIDATE,
      POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });
});
