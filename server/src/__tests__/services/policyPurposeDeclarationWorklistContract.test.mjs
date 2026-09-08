/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyPurposeDeclarationWorklist,
} from '../../services/policyPurposeDeclarationWorklistContract.mjs';

const profilePurposeRule = (term) => ({
  signal_type: 'genres',
  operator: 'require_any',
  values: { require_any: [term] },
  constraint_mode: 'advisory',
  semantics: 'identity',
  source: 'media_server_library_profile',
  inference_state: 'inferred',
});

describe('policyPurposeDeclarationWorklistContract', () => {
  test('groups matching profile-derived drafts without exposing values or changing policy authority', () => {
    const worklist = buildPolicyPurposeDeclarationWorklist({
      records: [{
        policy_id: 17,
        policy_name: 'Animation policy',
        library_id: 18,
        library_name: 'Animation',
        library_media_type: 'movie',
        purpose_rules: [profilePurposeRule('must-not-leak')],
      }, {
        policy_id: 19,
        policy_name: 'Animation series policy',
        library_id: 20,
        library_name: 'Animation series',
        library_media_type: 'tv',
        purpose_rules: [profilePurposeRule('must-not-leak')],
      }, {
        policy_id: 21,
        policy_name: 'Drama policy',
        library_id: 22,
        library_name: 'Drama',
        library_media_type: 'movie',
        purpose_rules: [profilePurposeRule('also-not-visible')],
      }, {
        policy_id: 23,
        policy_name: 'Declared policy',
        library_id: 24,
        library_name: 'Declared',
        library_media_type: 'movie',
        purpose_rules: [{
          ...profilePurposeRule('already-declared'),
          source: 'native_intent',
        }],
      }],
      truncated: true,
    });

    expect(worklist).toEqual(expect.objectContaining({
      version: 'policy_purpose_declaration_worklist.v2',
      statusId: 'declaration_review_required',
      rawPurposeRulesExposed: false,
      policyStorageMutated: false,
      semanticSelectionAffected: false,
      routingAffected: false,
      summary: {
        reviewedPolicyCount: 4,
        declarationRequiredPolicyCount: 3,
        groupCount: 2,
        truncated: true,
      },
    }));
    expect(worklist.groups[0]).toEqual(expect.objectContaining({
      id: 'purpose_declaration_group_1',
      policyCount: 2,
      libraryCount: 2,
    }));
    expect(worklist.groups[0].entries.map(entry => entry.policy.id)).toEqual([17, 19]);
    expect(worklist.groups[0].entries[0]).toEqual(expect.objectContaining({
      purposeProvenance: {
        id: 'profile_derived',
        declarationRequired: true,
        rawRuleProvenanceExposed: false,
      },
      action: {
        actionId: 'review_and_declare_purpose',
        available: true,
      },
    }));
    expect(JSON.stringify(worklist)).not.toContain('must-not-leak');
    expect(JSON.stringify(worklist)).not.toContain('also-not-visible');
  });

  test('fails closed when no current purpose draft needs declaration review', () => {
    const worklist = buildPolicyPurposeDeclarationWorklist({
      records: [{
        policy_id: 17,
        library_id: 18,
        purpose_rules: [{
          ...profilePurposeRule('declared'),
          source: 'native_intent',
        }],
      }, {
        policy_id: 19,
        library_id: 20,
        purpose_rules: [{ signal_type: 'invalid' }],
      }],
    });

    expect(worklist).toEqual(expect.objectContaining({
      statusId: 'no_declaration_review_required',
      groups: [],
      summary: {
        reviewedPolicyCount: 2,
        declarationRequiredPolicyCount: 0,
        groupCount: 0,
        truncated: false,
      },
    }));
  });

  test('does not claim that no active policy needs review when the bounded window is truncated', () => {
    const worklist = buildPolicyPurposeDeclarationWorklist({
      records: [{
        policy_id: 17,
        library_id: 18,
        purpose_rules: [{
          ...profilePurposeRule('declared'),
          source: 'native_intent',
        }],
      }],
      truncated: true,
    });

    expect(worklist).toEqual(expect.objectContaining({
      statusId: 'declaration_review_window_truncated',
      groups: [],
      summary: {
        reviewedPolicyCount: 1,
        declarationRequiredPolicyCount: 0,
        groupCount: 0,
        truncated: true,
      },
    }));
  });
});
