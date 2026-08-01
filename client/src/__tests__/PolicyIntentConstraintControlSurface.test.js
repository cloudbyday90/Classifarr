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
import PolicyIntentConstraintControlSurface from '@/components/policies/PolicyIntentConstraintControlSurface.vue'

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
        options: [
          {
            value: 'evidence_missing',
            label: 'Evidence is missing',
            description: 'Ask when Classifarr does not have enough evidence to automate safely.',
          },
          {
            value: 'evidence_conflicting',
            label: 'Evidence conflicts',
            description: 'Ask when strong signals point to different destinations.',
          },
        ],
      },
    ],
    rawPayloadExposed: false,
    ...overrides,
  }
}

function findButton(wrapper, label) {
  return wrapper.findAll('button').find(button => button.text() === label)
}

describe('PolicyIntentConstraintControlSurface.vue', () => {
  it('requires an explicit confirmation before staging a blocking hard limit', async () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    const hardLimitButton = findButton(wrapper, 'Stage hard limit')
    expect(wrapper.text()).toContain('This is a blocker')
    expect(hardLimitButton.attributes('disabled')).toBeDefined()

    await wrapper.find('#policy-intent-constraint-hard_limit-value').setValue('PG-13')
    expect(hardLimitButton.attributes('aria-label')).toContain('confirm this explicit operator choice first')
    await wrapper.find('#policy-intent-constraint-hard_limit-confirmation').setValue(true)
    await hardLimitButton.trigger('click')

    expect(wrapper.emitted('draft-command-plan')?.[0]?.[0]).toMatchObject({
      commandCount: 1,
      commands: [{
        commandId: 'set_hard_limit',
        controlId: 'hard_limit',
        values: ['PG-13'],
        explicitOperatorAction: true,
      }],
    })
    expect(wrapper.find('#policy-intent-constraint-hard_limit-value').element.value).toBe('')
    expect(wrapper.find('#policy-intent-constraint-hard_limit-confirmation').element.checked).toBe(false)
  })

  it('stages an advisory review warning without presenting it as a blocker', async () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    expect(wrapper.text()).toContain('This is advisory')
    await wrapper.find('#policy-intent-constraint-review_warning-value').setValue('evidence_conflicting')
    await findButton(wrapper, 'Stage review warning').trigger('click')

    expect(wrapper.emitted('draft-command-plan')?.[0]?.[0]).toMatchObject({
      commands: [{
        commandId: 'add_review_warning',
        controlId: 'review_warning',
        values: ['evidence_conflicting'],
        decisionEffectId: 'request_review',
      }],
    })
  })

  it('emits a typed advisory avoid plan instead of a legacy certification config command', async () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    const avoidButton = findButton(wrapper, 'Stage avoid value')
    await wrapper.find('#policy-intent-constraint-avoid-value').setValue('R')
    await wrapper.find('#policy-intent-constraint-avoid-confirmation').setValue(true)
    await avoidButton.trigger('click')

    expect(wrapper.emitted('draft-command-plan')?.[0]?.[0]).toMatchObject({
      version: 'policy.intent_constraint_command_plan.v1',
      componentId: 'intent_constraint_draft_adapter',
      commandBoundary: 'typed_draft_commands',
      commands: [{
        commandId: 'add_avoid_value',
        controlId: 'avoid',
        decisionEffectId: 'reduce_confidence',
        values: ['R'],
        explicitOperatorAction: true,
      }],
    })
    expect(wrapper.emitted('draft-set-signal-config')).toBeUndefined()
  })

  it('announces that staged constraints are local only and allows them to be cleared', async () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
        constraintDraftCommands: [{
          commandId: 'add_avoid_value',
          controlId: 'avoid',
          intentId: 'advisory_avoid',
          decisionEffectId: 'reduce_confidence',
          certificationSemanticId: 'avoid_rating',
          values: ['R'],
          sourceId: 'operator_declared',
          explicitOperatorAction: true,
          inferredFromAbsence: false,
        }],
      },
    })

    expect(wrapper.find('[role="status"]').text()).toContain('do not save')
    expect(wrapper.text()).toContain('1 local constraint is staged and not saved')
    expect(wrapper.text()).toContain('Staged: R')

    await findButton(wrapper, 'Clear staged constraints').trigger('click')
    expect(wrapper.emitted('clear-constraint-draft')).toHaveLength(1)
  })

  it('fails closed instead of exposing controls for an invalid model', () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel({ rawPayloadExposed: true }),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    expect(wrapper.find('[role="alert"]').text()).toContain('unavailable')
    expect(wrapper.findAll('select')).toHaveLength(0)
  })

  it('renders only the server-projected values and rejects a missing eligibility projection', () => {
    const wrapper = mount(PolicyIntentConstraintControlSurface, {
      props: {
        constraintDecisionModel: constraintDecisionModel(),
        constraintValueEligibility: constraintValueEligibility(),
      },
    })

    expect(wrapper.find('#policy-intent-constraint-hard_limit-value').text()).toContain('PG-13')
    expect(wrapper.find('#policy-intent-constraint-hard_limit-value').text()).not.toContain('TV-14')

    const unavailable = mount(PolicyIntentConstraintControlSurface, {
      props: { constraintDecisionModel: constraintDecisionModel() },
    })
    expect(unavailable.find('[role="alert"]').text()).toContain('unavailable')
  })
})
