/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateContrastiveEvidencePresentation,
  normalizePolicyCandidateContrastiveEvidence,
} from '@/utils/policyCandidateContrastiveEvidencePresentation'

describe('policyCandidateContrastiveEvidencePresentation', () => {
  it('maps fixed counter-evidence copy and strips catalog details', () => {
    const evidence = {
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'alternative_identity_match',
      library_ids: [9],
      title: 'Do not render this title.',
    }

    expect(getPolicyCandidateContrastiveEvidencePresentation(evidence)).toEqual({
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'alternative_identity_match',
      label: 'Current inventory favors an alternative',
      message: 'The exact stable item identity appears in an alternative candidate’s current inventory, not the leading candidate. Treat this as counter-evidence and review the alternatives before confirming.',
      tone: 'conflict',
    })
  })

  it('fails closed for unknown provenance, status, or version', () => {
    expect(normalizePolicyCandidateContrastiveEvidence({
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'unknown',
      status_id: 'alternative_identity_match',
    })).toBeNull()
    expect(normalizePolicyCandidateContrastiveEvidence({
      version: 'future',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'unreviewed',
    })).toBeNull()
  })
})
