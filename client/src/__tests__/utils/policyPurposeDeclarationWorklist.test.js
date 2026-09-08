/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyPurposeDeclarationWorklist,
} from '@/utils/policyPurposeDeclarationWorklist'

const entry = {
  policy: { id: 17, name: 'Animation policy' },
  library: { id: 18, name: 'Animation', mediaType: 'movie' },
  purposeProvenance: {
    id: 'profile_derived',
    declarationRequired: true,
    rawRuleProvenanceExposed: false,
  },
  action: { actionId: 'review_and_declare_purpose', available: true },
}

const worklist = {
  version: 'policy_purpose_declaration_worklist.v2',
  statusId: 'declaration_review_required',
  groups: [{
    id: 'purpose_declaration_group_1',
    policyCount: 1,
    libraryCount: 1,
    entries: [entry],
  }],
  summary: {
    reviewedPolicyCount: 1,
    declarationRequiredPolicyCount: 1,
    groupCount: 1,
    truncated: false,
  },
  rawPurposeRulesExposed: false,
  policyStorageMutated: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('policyPurposeDeclarationWorklist', () => {
  it('normalizes the closed redacted worklist contract', () => {
    expect(normalizePolicyPurposeDeclarationWorklist(worklist)).toEqual(worklist)
  })

  it('rejects unexpected raw configuration fields and inconsistent aggregate counts', () => {
    expect(normalizePolicyPurposeDeclarationWorklist({
      ...worklist,
      groups: [{ ...worklist.groups[0], rawPurposeRules: ['must-not-display'] }],
    })).toBeNull()
    expect(normalizePolicyPurposeDeclarationWorklist({
      ...worklist,
      summary: { ...worklist.summary, declarationRequiredPolicyCount: 2 },
    })).toBeNull()
    expect(normalizePolicyPurposeDeclarationWorklist({
      ...worklist,
      groups: [{ ...worklist.groups[0], id: 'untrusted-group' }],
    })).toBeNull()
  })

  it('accepts an explicit truncated-window state but rejects a global no-review claim', () => {
    const truncatedWindow = {
      ...worklist,
      statusId: 'declaration_review_window_truncated',
      groups: [],
      summary: {
        reviewedPolicyCount: 1,
        declarationRequiredPolicyCount: 0,
        groupCount: 0,
        truncated: true,
      },
    }

    expect(normalizePolicyPurposeDeclarationWorklist(truncatedWindow)).toEqual(truncatedWindow)
    expect(normalizePolicyPurposeDeclarationWorklist({
      ...truncatedWindow,
      statusId: 'no_declaration_review_required',
    })).toBeNull()
  })
})
