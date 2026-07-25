/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, test } from '@jest/globals';
import { buildNativePendingQuestionPresentation } from '../../services/policyNativePendingQuestionPresentation.mjs';

function nativeQuestion(overrides = {}) {
  return {
    version: 'policy.runtime_question_persistence.v1',
    runtimeQuestion: {
      contractVersion: 'policy.runtime_question_reduction.v1',
    },
    runtimeQuestionReductionPlan: {
      version: 'policy.runtime_question_reduction.v1',
    },
    options: [
      {
        label: 'Resolve current item',
        outcomeId: 'resolve_current_item',
        library_id: 6,
      },
      {
        label: 'Do not learn',
        outcomeId: 'do_not_learn',
      },
    ],
    meta: {
      runtime_question_persistence: {
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
      },
    },
    ...overrides,
  };
}

describe('policyNativePendingQuestionPresentation', () => {
  test('projects canonical outcome-only actions and an explicit alternate destination path', () => {
    const result = buildNativePendingQuestionPresentation(nativeQuestion());

    expect(result).toEqual({
      destination: {
        libraryId: 6,
        libraryName: 'Animated Movies',
      },
      actions: [
        {
          id: 'resolve_current_item',
          label: 'Resolve in Animated Movies',
          optionIndex: 0,
          selectedOptionLabel: 'Resolve current item',
          style: 'success',
        },
        {
          id: 'do_not_learn',
          label: 'Resolve without learning',
          optionIndex: 1,
          selectedOptionLabel: 'Do not learn',
          style: 'secondary',
        },
      ],
      alternativeDestination: {
        label: 'Choose another destination',
        selectedOptionLabel: 'Choose another destination',
      },
    });
  });

  test('fails closed for malformed native presentation data and all legacy questions', () => {
    expect(buildNativePendingQuestionPresentation(nativeQuestion({
      options: [{ label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: 99 }],
    }))).toBeNull();
    expect(buildNativePendingQuestionPresentation({
      question: 'Which library?',
      options: [{ label: 'Movies', library_id: 6 }],
    })).toBeNull();
  });
});
