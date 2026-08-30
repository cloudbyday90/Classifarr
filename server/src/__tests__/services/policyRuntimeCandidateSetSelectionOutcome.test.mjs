/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyRuntimeCandidateSetSelectionOutcome,
} from '../../services/policyRuntimeCandidateSetSelectionOutcome.mjs';

const candidates = [
  { library_id: 4, library_name: 'Private Movies' },
  { library_id: 8, library_name: 'Private Television' },
];

describe('policyRuntimeCandidateSetSelectionOutcome', () => {
  test.each([
    ['confirm_destination', 4, 'confirmed_candidate'],
    ['change_destination', 8, 'changed_to_candidate'],
    ['change_destination', 12, 'changed_outside_candidates'],
    ['route_not_applicable', 12, 'routed_not_applicable'],
  ])('reduces %s without retaining library identity', (actionId, libraryId, statusId) => {
    const outcome = buildPolicyRuntimeCandidateSetSelectionOutcome({
      answer: { actionId },
      candidateDestinations: candidates,
      selectedDestinationLibraryId: libraryId,
    });

    expect(outcome).toEqual({ statusId });
    expect(JSON.stringify(outcome)).not.toContain(String(libraryId));
    expect(JSON.stringify(outcome)).not.toContain('Private Movies');
  });

  test('fails closed for an unbounded candidate set or unsupported action', () => {
    expect(buildPolicyRuntimeCandidateSetSelectionOutcome({
      answer: { actionId: 'confirm_destination' },
      candidateDestinations: [{ library_id: 4 }],
      selectedDestinationLibraryId: 4,
    })).toBeNull();
    expect(buildPolicyRuntimeCandidateSetSelectionOutcome({
      answer: { actionId: 'untrusted_browser_action' },
      candidateDestinations: candidates,
      selectedDestinationLibraryId: 12,
    })).toBeNull();
  });
});
