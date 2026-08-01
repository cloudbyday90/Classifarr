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
import { mount } from '@vue/test-utils'
import HardLimitControl from '@/components/policies/HardLimitControl.vue'

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
        description: 'Lowers confidence without becoming a hard block.',
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
        options: [{
          value: 'evidence_missing',
          label: 'Evidence is missing',
          description: null,
        }],
      },
    ],
    rawPayloadExposed: false,
    ...overrides,
  }
}

describe('HardLimitControl.vue', () => {
  it('requires explicit confirmation before emitting the established typed hard-limit plan', async () => {
    const wrapper = mount(HardLimitControl, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
        statusId: 'policy-intent-constraint-controls-status',
      },
    })

    const stageButton = wrapper.get('button')
    expect(wrapper.text()).toContain('This is a blocker')
    expect(wrapper.get('select').attributes('aria-describedby'))
      .toBe('policy-intent-constraint-hard_limit-description policy-intent-constraint-controls-status')
    expect(stageButton.attributes('disabled')).toBeDefined()

    await wrapper.get('#policy-intent-constraint-hard_limit-value').setValue('PG-13')
    expect(stageButton.attributes('aria-label')).toContain('confirm this explicit operator choice first')
    await wrapper.get('#policy-intent-constraint-hard_limit-confirmation').setValue(true)
    await stageButton.trigger('click')

    expect(wrapper.emitted('draft-command-plan')).toEqual([[expect.objectContaining({
      version: 'policy.intent_constraint_command_plan.v1',
      componentId: 'intent_constraint_draft_adapter',
      commandBoundary: 'typed_draft_commands',
      commands: [expect.objectContaining({
        commandId: 'set_hard_limit',
        controlId: 'hard_limit',
        values: ['PG-13'],
        explicitOperatorAction: true,
      })],
    })]])
    expect(wrapper.get('#policy-intent-constraint-hard_limit-value').element.value).toBe('')
    expect(wrapper.get('#policy-intent-constraint-hard_limit-confirmation').element.checked).toBe(false)
  })

  it('fails closed for an invalid decision model instead of exposing a local hard-limit control', () => {
    const wrapper = mount(HardLimitControl, {
      props: {
        constraintDecisionModel: constraintDecisionModel({ rawPayloadExposed: true }),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    expect(wrapper.find('fieldset').exists()).toBe(false)
    expect(wrapper.findAll('select')).toHaveLength(0)
    expect(wrapper.emitted('draft-command-plan')).toBeUndefined()
  })
})
