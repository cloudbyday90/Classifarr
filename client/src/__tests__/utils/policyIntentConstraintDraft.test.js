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
import {
  applyPolicyIntentConstraintCommandPlan,
  buildPolicyIntentConstraintCommandPlan,
  isApprovedConstraintDecisionModel,
  isPolicyIntentConstraintCommandPlan,
} from '@/utils/policyIntentConstraintDraft'

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

describe('policyIntentConstraintDraft', () => {
  it('creates one transient typed command from an explicit selection and the server decision model', () => {
    const plan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: constraintDecisionModel(),
      selection: {
        controlId: 'hard_limit',
        value: ' PG-13 ',
        explicitOperatorAction: true,
      },
    })

    expect(plan).toEqual({
      version: 'policy.intent_constraint_command_plan.v1',
      componentId: 'intent_constraint_draft_adapter',
      commandBoundary: 'typed_draft_commands',
      commandCount: 1,
      commands: [
        {
          commandId: 'set_hard_limit',
          controlId: 'hard_limit',
          intentId: 'blocking_constraint',
          decisionEffectId: 'block_automatic_application',
          certificationSemanticId: 'max_allowed_rating',
          values: ['PG-13'],
          sourceId: 'operator_declared',
          explicitOperatorAction: true,
          inferredFromAbsence: false,
        },
      ],
    })
    expect(Object.isFrozen(plan)).toBe(true)
    expect(isPolicyIntentConstraintCommandPlan(plan)).toBe(true)
  })

  it('uses the server-projected avoid and review meanings without turning them into a blocker', () => {
    const model = constraintDecisionModel()
    const avoidPlan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      selection: {
        controlId: 'avoid',
        value: 'R',
        explicitOperatorAction: true,
      },
    })
    const reviewPlan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      selection: {
        controlId: 'review_warning',
        value: 'evidence_missing',
        explicitOperatorAction: true,
      },
    })

    expect(avoidPlan.commands[0]).toEqual(expect.objectContaining({
      commandId: 'add_avoid_value',
      decisionEffectId: 'reduce_confidence',
      certificationSemanticId: 'avoid_rating',
    }))
    expect(reviewPlan.commands[0]).toEqual(expect.objectContaining({
      commandId: 'add_review_warning',
      decisionEffectId: 'request_review',
      certificationSemanticId: null,
    }))
  })

  it('fails closed for malformed server projections, unconfirmed selections, and unapproved selection fields', () => {
    const model = constraintDecisionModel()
    const malformedModel = constraintDecisionModel({ rawPayloadExposed: true })

    expect(isApprovedConstraintDecisionModel(model)).toBe(true)
    expect(isApprovedConstraintDecisionModel(malformedModel)).toBe(false)
    expect(buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: malformedModel,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13',
        explicitOperatorAction: true,
      },
    })).toBeNull()
    expect(buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13',
        explicitOperatorAction: false,
      },
    })).toBeNull()
    expect(buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13',
        explicitOperatorAction: true,
        policyId: 4,
      },
    })).toBeNull()
    expect(buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: model,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13\nR',
        explicitOperatorAction: true,
      },
    })).toBeNull()
  })

  it('keeps command state local and rejects injected persistence, routing, and compatibility fields', () => {
    const plan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: constraintDecisionModel(),
      selection: {
        controlId: 'avoid',
        value: 'R',
        explicitOperatorAction: true,
      },
    })
    const injectedPlan = {
      ...plan,
      policyId: 3,
    }

    const commands = applyPolicyIntentConstraintCommandPlan([], plan)

    expect(commands).toEqual(plan.commands)
    expect(commands[0]).not.toHaveProperty('policyId')
    expect(commands[0]).not.toHaveProperty('routeNow')
    expect(commands[0]).not.toHaveProperty('customSignals')
    expect(applyPolicyIntentConstraintCommandPlan([], injectedPlan)).toEqual([])
    expect(applyPolicyIntentConstraintCommandPlan(commands, plan)).toEqual(commands)
  })
})
