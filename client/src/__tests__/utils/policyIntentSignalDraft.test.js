/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  applyIntentSignalCommandPlan,
  buildDeclaredIntentFromIntentSignals,
  buildIntentSignalCommandPlan,
} from '@/utils/policyIntentSignalDraft'

function candidate(overrides = {}) {
  return {
    candidateId: 'genre:Animation:purpose',
    value: 'Animation',
    label: 'Animation',
    sourceId: 'suggested_from_observed_profile',
    sourceLabel: 'Suggested from this library',
    selectionStateId: 'selectable_suggestion',
    selectable: true,
    readOnlyEvidence: false,
    commandId: 'add_signal_value',
    signalType: 'genres',
    operator: 'require_any',
    questionId: 'what_belongs_here',
    explanation: 'Animation appears in 48 items in the current library.',
    evidence: { count: 48, confidence: 0.84 },
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    ...overrides,
  }
}

describe('policyIntentSignalDraft', () => {
  it('turns only normalized, explicit candidates into typed intent-signal commands', () => {
    const plan = buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: [candidate(), candidate({
        candidateId: 'rating:PG:purpose',
        signalType: 'ratings',
        value: 'PG',
      }), candidate({
        candidateId: 'genre:AutoDeclared:purpose',
        value: 'Auto Declared',
        canAutoDeclare: true,
      })],
    })

    expect(plan).toEqual(expect.objectContaining({
      version: 'policy.intent_signal_command_plan.v1',
      componentId: 'intent_signal_picker',
      commandBoundary: 'typed_draft_commands',
      commands: [expect.objectContaining({
        commandId: 'add_signal_value',
        candidate: expect.objectContaining({ value: 'Animation' }),
      })],
    }))
  })

  it('accepts server-projected starter-template and common candidates without inferring source behavior', () => {
    const plan = buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: [
        candidate({
          candidateId: 'template:holiday:keyword:christmas',
          value: 'Christmas',
          label: 'Christmas',
          sourceId: 'suggested_from_starter_template',
          sourceLabel: 'Suggested by starter template',
          signalType: 'keywords',
          explanation: 'Suggested by the optional Holiday starter template.',
          evidence: { count: 0, confidence: null },
          templateId: 'holiday',
          templateName: 'Holiday',
        }),
        candidate({
          candidateId: 'common:mystery',
          value: 'Mystery',
          sourceId: 'common_static_option',
          sourceLabel: 'Common options',
          explanation: 'Mystery is a common option. Confirm it reflects this destination before adding it.',
          evidence: { count: 0, confidence: null },
        }),
      ],
    })

    expect(plan.commands.map(command => command.candidate.value)).toEqual(['Christmas', 'Mystery'])
    expect(plan.commands[0].candidate).not.toHaveProperty('templateId')
    expect(plan.commands[0].candidate).not.toHaveProperty('templateName')
  })

  it('rejects unapproved candidate sources before they can become draft commands', () => {
    const plan = buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: [candidate({ sourceId: 'raw_template_attachment' })],
    })

    expect(plan.commands).toEqual([])
  })

  it('adds and removes accepted signals only through typed command plans', () => {
    const added = applyIntentSignalCommandPlan([], buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: [candidate()],
    }))
    const removed = applyIntentSignalCommandPlan(added, buildIntentSignalCommandPlan({
      commandId: 'remove_signal_value',
      candidates: [candidate()],
    }))

    expect(added).toHaveLength(1)
    expect(removed).toEqual([])
  })

  it('materializes accepted values as grouped native purpose rules', () => {
    expect(buildDeclaredIntentFromIntentSignals([
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
