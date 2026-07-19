import { describe, expect, it } from 'vitest'
import {
  applyObservedSuggestionCommandPlan,
  buildDeclaredIntentFromObservedSuggestions,
  buildObservedSuggestionCommandPlan,
} from '@/utils/policyObservedSuggestionDraft'

function candidate(overrides = {}) {
  return {
    candidateId: 'genre:Animation:purpose',
    value: 'Animation',
    label: 'Animation',
    signalType: 'genres',
    operator: 'require_any',
    questionId: 'what_belongs_here',
    sourceId: 'suggested_from_observed_profile',
    explanation: 'Animation appears in 48 items in the current library.',
    evidenceCount: 48,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    ...overrides,
  }
}

describe('policyObservedSuggestionDraft', () => {
  it('turns only explicit, supported observed candidates into typed add commands', () => {
    const plan = buildObservedSuggestionCommandPlan({
      commandId: 'add_signal_value',
      candidates: [candidate(), candidate({
        candidateId: 'rating:PG:purpose',
        signalType: 'ratings',
        value: 'PG',
      })],
    })

    expect(plan).toEqual(expect.objectContaining({
      commandBoundary: 'typed_draft_commands',
      commands: [expect.objectContaining({
        commandId: 'add_signal_value',
        candidate: expect.objectContaining({ value: 'Animation' }),
      })],
    }))
  })

  it('adds and removes accepted candidates only through typed plans', () => {
    const added = applyObservedSuggestionCommandPlan([], buildObservedSuggestionCommandPlan({
      commandId: 'add_signal_value',
      candidates: [candidate()],
    }))
    const removed = applyObservedSuggestionCommandPlan(added, buildObservedSuggestionCommandPlan({
      commandId: 'remove_signal_value',
      candidates: [candidate()],
    }))

    expect(added).toHaveLength(1)
    expect(removed).toEqual([])
  })

  it('materializes accepted values as grouped native purpose rules', () => {
    expect(buildDeclaredIntentFromObservedSuggestions([
      candidate(),
      candidate({
        candidateId: 'genre:Family:purpose',
        value: 'Family',
        label: 'Family',
      }),
      candidate({
        candidateId: 'studio:Ghibli:purpose',
        value: 'Studio Ghibli',
        label: 'Studio Ghibli',
        signalType: 'studios',
      }),
    ])).toEqual({
      purpose: [
        {
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation', 'Family'] },
        },
        {
          signal_type: 'studios',
          operator: 'require_any',
          values: { require_any: ['Studio Ghibli'] },
        },
      ],
      hard_limits: [],
      helpful_hints: [],
      avoid: [],
    })
  })
})
