/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentConstraintCommandPlan } from '@/utils/policyIntentConstraintDraft'
import { buildPolicyIntentConstraintControlSurface } from '@/utils/policyIntentConstraintControlSurface'

function constraintDecisionModel(overrides = {}) {
  return {
    version: 'policy.constraint_decision_model.v1',
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientCanInferConstraintMeaning: false,
    },
    controls: [
      {
        controlId: 'hard_limit',
        intentId: 'blocking_constraint',
        label: 'Hard limit',
        questionId: 'what_should_not_go_here',
        description: 'Blocks items that violate this destination boundary.',
        draftCommandId: 'set_hard_limit',
        decisionEffectId: 'block_automatic_application',
        requiresExplicitOperatorAction: true,
        observedAbsenceBehaviorId: 'not_a_declaration_source',
        certificationSemanticId: 'max_allowed_rating',
        canBlockAutomaticApplication: true,
      },
      {
        controlId: 'avoid',
        intentId: 'advisory_avoid',
        label: 'Avoid',
        questionId: 'what_should_not_go_here',
        description: 'Lowers confidence or asks for review without becoming a hard block by default.',
        draftCommandId: 'add_avoid_value',
        decisionEffectId: 'reduce_confidence',
        requiresExplicitOperatorAction: true,
        observedAbsenceBehaviorId: 'not_a_declaration_source',
        certificationSemanticId: 'avoid_rating',
        canBlockAutomaticApplication: false,
      },
      {
        controlId: 'review_warning',
        intentId: 'non_blocking_warning',
        label: 'Review warning',
        questionId: 'when_should_classifarr_ask',
        description: 'Asks the operator when evidence is weak or missing.',
        draftCommandId: 'add_review_warning',
        decisionEffectId: 'request_review',
        requiresExplicitOperatorAction: false,
        observedAbsenceBehaviorId: 'review_warning_only',
        certificationSemanticId: null,
        canBlockAutomaticApplication: false,
      },
    ],
    rawPayloadExposed: false,
    ...overrides,
  }
}

function constraintValueEligibility(overrides = {}) {
  const ratingOptions = ['G', 'PG', 'PG-13', 'R', 'NC-17']
    .map(value => ({ value, label: value, description: null }))

  return {
    version: 'policy.constraint_value_eligibility.v1',
    statusId: 'ready',
    libraryMediaTypeFamilyId: 'movie',
    authority: {
      displayProjection: true,
      serverOwnedAllowlist: true,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientMayAddValues: false,
    },
    controls: [
      {
        controlId: 'hard_limit',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'avoid',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'review_warning',
        valueKindId: 'review_trigger',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ['evidence_missing', 'evidence_conflicting', 'profile_stale', 'routing_not_ready']
          .map(value => ({ value, label: value, description: null })),
      },
    ],
    rawPayloadExposed: false,
    ...overrides,
  }
}

describe('policyIntentConstraintControlSurface', () => {
  it('keeps the server-owned blocking and advisory meanings distinct in the display projection', () => {
    const surface = buildPolicyIntentConstraintControlSurface({
      constraintDecisionModel: constraintDecisionModel(),
      constraintValueEligibility: constraintValueEligibility(),
    })

    expect(surface).toMatchObject({
      available: true,
      stagedCommandCount: 0,
      controls: [
        {
          controlId: 'hard_limit',
          valueLabel: 'Maximum allowed rating',
          canBlockAutomaticApplication: true,
          requiresExplicitOperatorAction: true,
        },
        {
          controlId: 'avoid',
          valueLabel: 'Rating to avoid',
          canBlockAutomaticApplication: false,
          requiresExplicitOperatorAction: true,
        },
        {
          controlId: 'review_warning',
          valueLabel: 'When should Classifarr ask?',
          canBlockAutomaticApplication: false,
          requiresExplicitOperatorAction: false,
        },
      ],
    })
    expect(surface.message).toContain('do not save')
  })

  it('shows only validated local commands as staged values', () => {
    const model = constraintDecisionModel()
    const eligibility = constraintValueEligibility()
    const plan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      constraintValueEligibility: eligibility,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13',
        explicitOperatorAction: true,
      },
    })

    const surface = buildPolicyIntentConstraintControlSurface({
      constraintDecisionModel: model,
      constraintValueEligibility: eligibility,
      constraintDraftCommands: plan.commands,
    })

    expect(surface.stagedCommandCount).toBe(1)
    expect(surface.controls.find(control => control.controlId === 'hard_limit')?.stagedValues).toEqual(['PG-13'])
    expect(surface.controls.find(control => control.controlId === 'avoid')?.stagedValues).toEqual([])
  })

  it('fails closed when the server decision model is invalid', () => {
    expect(buildPolicyIntentConstraintControlSurface({
      constraintDecisionModel: constraintDecisionModel({ rawPayloadExposed: true }),
      constraintValueEligibility: constraintValueEligibility(),
    })).toMatchObject({
      available: false,
      controls: [],
      stagedCommandCount: 0,
    })
  })

  it('fails closed when the value eligibility projection is malformed or unavailable', () => {
    expect(buildPolicyIntentConstraintControlSurface({
      constraintDecisionModel: constraintDecisionModel(),
      constraintValueEligibility: constraintValueEligibility({ rawPayloadExposed: true }),
    })).toMatchObject({ available: false, controls: [] })

    expect(buildPolicyIntentConstraintControlSurface({
      constraintDecisionModel: constraintDecisionModel(),
      constraintValueEligibility: {
        ...constraintValueEligibility(),
        statusId: 'unsupported_library_media_type',
        libraryMediaTypeFamilyId: null,
        controls: [],
      },
    })).toMatchObject({
      available: false,
      message: expect.stringContaining('no supported canonical rating family'),
    })
  })
})
