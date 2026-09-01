/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  projectPolicyCandidateDecision,
} from '../../services/policyCandidateDecisionProjection.mjs';
import {
  projectRankedPolicyCandidates,
} from '../../services/policyCandidateRankingProjection.mjs';

function candidate({
  libraryId,
  policyId,
  score,
  evidenceClass = 'identity',
  primaryViability = 'identity_evidence',
  primaryAnchorEligible = true,
} = {}) {
  return {
    library_id: libraryId,
    policy_id: policyId,
    score,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    candidate_diagnostics: {
      evidence_class: evidenceClass,
      primary_anchor_eligible: primaryAnchorEligible,
      primary_viability: primaryViability,
    },
  };
}

describe('policy candidate ranking projection', () => {
  test('uses production calibration before deterministic opaque-ID ordering', () => {
    const ranked = projectRankedPolicyCandidates([
      candidate({
        libraryId: 1,
        policyId: 1,
        score: 92,
        evidenceClass: 'broad_compatibility_overlap',
        primaryViability: 'compatibility_only',
      }),
      candidate({ libraryId: 2, policyId: 2, score: 70 }),
      candidate({ libraryId: 3, policyId: 3, score: 70 }),
    ]);

    expect(ranked.map(value => value.policy_id)).toEqual([2, 3, 1]);
    expect(ranked[2]).toEqual(expect.objectContaining({ raw_score: 92, score: 55 }));
  });

  test('projects conservative weak-overlap action without finalizing a decision', () => {
    const ranked = projectRankedPolicyCandidates([
      candidate({
        libraryId: 1,
        policyId: 1,
        score: 90,
        evidenceClass: 'compatibility',
        primaryViability: 'compatibility_only',
      }),
      candidate({
        libraryId: 2,
        policyId: 2,
        score: 90,
        evidenceClass: 'broad_compatibility_overlap',
        primaryViability: 'compatibility_only',
      }),
    ]);

    expect(projectPolicyCandidateDecision({ ranked })).toEqual(expect.objectContaining({
      action: 'manual',
      decisionDiagnostics: {
        requires_manual_review: true,
        reason_code: 'weak_evidence_overlap',
        candidate_count: 2,
      },
    }));
  });
});
