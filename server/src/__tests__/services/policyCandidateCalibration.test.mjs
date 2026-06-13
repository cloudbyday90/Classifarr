import {
  calibratePolicyCandidate,
} from '../../services/policyCandidateCalibration.mjs';

function candidate(score, diagnostics = {}) {
  return {
    score,
    policy_id: 1,
    library_id: 1,
    candidate_diagnostics: diagnostics,
  };
}

describe('policyCandidateCalibration', () => {
  test('leaves identity evidence scores unchanged', () => {
    const result = calibratePolicyCandidate(candidate(82, {
      primary_viability: 'identity_evidence',
      evidence_class: 'identity',
    }));

    expect(result.score).toBe(82);
    expect(result.raw_score).toBe(82);
    expect(result.candidate_diagnostics.score_calibration).toEqual(expect.objectContaining({
      applied: false,
      reason_code: 'strong_evidence',
      multiplier: 1,
    }));
  });

  test('demotes compatibility-only evidence with multiplier and cap', () => {
    const result = calibratePolicyCandidate(candidate(92, {
      primary_viability: 'compatibility_only',
      evidence_class: 'compatibility',
    }));

    expect(result.score).toBe(55);
    expect(result.raw_score).toBe(92);
    expect(result.candidate_diagnostics.score_calibration).toEqual(expect.objectContaining({
      applied: true,
      multiplier: 0.6,
      cap: 55,
      reason_code: 'compatibility_only',
    }));
  });

  test('demotes profile-only and rag-only candidates below strong evidence', () => {
    expect(calibratePolicyCandidate(candidate(90, {
      primary_viability: 'profile_only',
      evidence_class: 'profile_only',
    })).score).toBe(58.5);

    expect(calibratePolicyCandidate(candidate(90, {
      primary_viability: 'rag_improved',
      evidence_class: 'rag_only',
    })).score).toBe(60);
  });

  test('zeroes negative conflicts', () => {
    const result = calibratePolicyCandidate(candidate(94, {
      primary_viability: 'rag_improved',
      evidence_class: 'negative_conflict',
    }));

    expect(result.score).toBe(0);
    expect(result.candidate_diagnostics.score_calibration.reason_code).toBe('negative_conflict');
  });

  test('calibrates arrays without mutating original candidates', () => {
    const input = [candidate(90, { primary_viability: 'compatibility_only' })];
    const result = input.map(c => calibratePolicyCandidate(c));

    expect(result[0]).not.toBe(input[0]);
    expect(input[0].score).toBe(90);
    expect(result[0].score).toBe(54);
  });
});
