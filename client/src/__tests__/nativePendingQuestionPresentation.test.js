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

import { describe, expect, it } from 'vitest'
import {
  buildNativePendingQuestionPresentation,
  isNativePendingQuestion,
} from '@/utils/nativePendingQuestionPresentation'

function nativeQuestion(overrides = {}) {
  return {
    version: 'policy.runtime_question_persistence.v1',
    runtimeQuestion: { contractVersion: 'policy.runtime_question_reduction.v1' },
    runtimeQuestionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
    options: [
      { label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: 10 },
      { label: 'Do not learn', outcomeId: 'do_not_learn' },
    ],
    meta: {
      runtime_question_persistence: {
        destinationLibraryId: 10,
        destinationLibraryName: 'TV Shows',
      },
    },
    ...overrides,
  }
}

describe('nativePendingQuestionPresentation', () => {
  it('renders only the two outcome actions plus an explicit alternative', () => {
    expect(buildNativePendingQuestionPresentation(nativeQuestion())).toMatchObject({
      destination: { libraryId: 10, libraryName: 'TV Shows' },
      actions: [
        { id: 'resolve_current_item', label: 'Resolve in TV Shows' },
        { id: 'do_not_learn', label: 'Resolve without learning' },
      ],
      alternativeDestination: { label: 'Choose another destination' },
    })
  })

  it('recognizes the envelope but refuses a malformed presentation projection', () => {
    const malformed = nativeQuestion({
      options: [{ label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: 5 }],
    })

    expect(isNativePendingQuestion(malformed)).toBe(true)
    expect(buildNativePendingQuestionPresentation(malformed)).toBeNull()
    expect(isNativePendingQuestion({ question: 'Legacy question' })).toBe(false)
  })
})
