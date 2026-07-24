/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { usePolicyIntentConstraintDraft } from '@/composables/usePolicyIntentConstraintDraft'
import { buildPolicyIntentConstraintCommandPlan } from '@/utils/policyIntentConstraintDraft'

function constraintDecisionModel() {
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
  }
}

function constraintValueEligibility() {
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
  }
}

describe('usePolicyIntentConstraintDraft', () => {
  it('stores only transient commands and clears them when the destination library changes', async () => {
    const libraryId = ref(4)
    const eligibility = ref(constraintValueEligibility())
    const draft = usePolicyIntentConstraintDraft({
      libraryId,
      constraintValueEligibility: eligibility,
    })
    const plan = buildPolicyIntentConstraintCommandPlan({
      constraintDecisionModel: constraintDecisionModel(),
      constraintValueEligibility: eligibility.value,
      selection: {
        controlId: 'hard_limit',
        value: 'PG-13',
        explicitOperatorAction: true,
      },
    })

    expect(draft.applyCommandPlan(plan)).toBe(true)
    expect(draft.hasConstraintDraftCommands.value).toBe(true)
    expect(draft.constraintDraftCommands.value).toHaveLength(1)

    libraryId.value = 5
    await nextTick()

    expect(draft.hasConstraintDraftCommands.value).toBe(false)
    expect(draft.constraintDraftCommands.value).toEqual([])
  })
})
