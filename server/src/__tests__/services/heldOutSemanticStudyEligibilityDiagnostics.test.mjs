/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  heldOutSemanticStudyEligibilityDiagnostic,
  heldOutSemanticStudyEligibilityDiagnosticCountId,
} from '../../services/heldOutSemanticStudyEligibilityDiagnostics.mjs';

test('projects only fixed broad-policy decision categories', () => {
  const diagnostic = heldOutSemanticStudyEligibilityDiagnostic({
    action: 'prompt_select',
    ranked: [{ library_id: 7 }, { library_id: 9 }, { library_id: 11 }],
  });

  expect(diagnostic).toEqual({ actionId: 'prompt_select', rankedCandidateCountId: 'two_or_more' });
  expect(heldOutSemanticStudyEligibilityDiagnosticCountId(diagnostic)).toBe('prompt_select:two_or_more');
  expect(JSON.stringify(diagnostic)).not.toMatch(/library|7|9|11/u);
});

test('fails closed to unknown action and no ranked candidates', () => {
  const diagnostic = heldOutSemanticStudyEligibilityDiagnostic({ action: 'untrusted', ranked: 'not-an-array' });

  expect(diagnostic).toEqual({ actionId: 'unknown', rankedCandidateCountId: 'none' });
  expect(heldOutSemanticStudyEligibilityDiagnosticCountId(diagnostic)).toBe('unknown:none');
});
