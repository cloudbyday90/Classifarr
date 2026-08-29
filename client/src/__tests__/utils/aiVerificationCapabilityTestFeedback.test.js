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
import { getAiVerificationCapabilityTestFeedback } from '@/utils/aiVerificationCapabilityTestFeedback'

describe('AI verification capability test feedback', () => {
  it('reports strict verification readiness only after a verified result', () => {
    expect(getAiVerificationCapabilityTestFeedback({
      ollamaVerificationCapability: { statusId: 'verification_ready' }
    })).toEqual({
      level: 'success',
      message: 'Ollama verification passed. Strict candidate verification is ready.'
    })
  })

  it('makes a completed but ineligible probe explicit', () => {
    expect(getAiVerificationCapabilityTestFeedback({
      ollamaVerificationCapability: { statusId: 'classification_only' }
    })).toEqual({
      level: 'warning',
      message: 'Ollama verification completed, but strict candidate verification is not available. General AI classification remains available.'
    })
  })

  it('fails safely when a response does not include a recognized capability state', () => {
    expect(getAiVerificationCapabilityTestFeedback({})).toEqual({
      level: 'warning',
      message: 'Ollama verification completed, but strict candidate verification is not available.'
    })
  })
})
