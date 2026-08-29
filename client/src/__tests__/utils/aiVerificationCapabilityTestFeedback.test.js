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
