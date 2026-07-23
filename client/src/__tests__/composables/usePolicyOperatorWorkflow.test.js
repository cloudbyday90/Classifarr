/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePolicyOperatorWorkflow } from '@/composables/usePolicyOperatorWorkflow'

function buildWorkflowRead(libraryId = 7) {
  return {
    version: 'policy.operator_workflow_read.v2',
    library: {
      id: libraryId,
      name: 'Movies',
    },
    observedProfile: {
      available: true,
      current: true,
      suggestionCount: 1,
      suggestions: [],
      intentSignalProjection: {
        version: 'policy.intent_signal_option_projection.v1',
        observedEvidence: [],
        options: [],
        customEntryInput: {
          enabled: true,
          signalTypes: [{ id: 'studios', label: 'Studio' }],
          valueMaximumLength: 160,
          explanationMaximumLength: 320,
          requiresExplanation: true,
        },
      },
    },
    workflow: {
      sections: [],
    },
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
  }
}

describe('usePolicyOperatorWorkflow', () => {
  it('loads only the validated display-only workflow projection', async () => {
    const loadWorkflowRequest = vi.fn().mockResolvedValue(buildWorkflowRead())
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })

    await expect(workflow.loadWorkflow(7)).resolves.toBe(true)

    expect(loadWorkflowRequest).toHaveBeenCalledWith(7)
    expect(workflow.workflowRead.value).toEqual(buildWorkflowRead())
    expect(workflow.loading.value).toBe(false)
    expect(workflow.error.value).toBe('')
  })

  it('clears state instead of issuing a request when no valid library is selected', async () => {
    const loadWorkflowRequest = vi.fn()
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })

    await expect(workflow.loadWorkflow('invalid')).resolves.toBe(false)

    expect(loadWorkflowRequest).not.toHaveBeenCalled()
    expect(workflow.workflowRead.value).toBeNull()
    expect(workflow.loading.value).toBe(false)
    expect(workflow.error.value).toBe('')
  })

  it('fails closed when a response claims write or automation authority', async () => {
    const loadWorkflowRequest = vi.fn().mockResolvedValue({
      ...buildWorkflowRead(),
      authority: {
        displayProjection: true,
        automationDecision: true,
        policyPersistence: false,
        routingExecution: false,
      },
    })
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })

    await expect(workflow.loadWorkflow(7)).resolves.toBe(false)

    expect(workflow.workflowRead.value).toBeNull()
    expect(workflow.error.value).toContain('could not load the library workflow')
  })

  it('fails closed when a response belongs to a different library', async () => {
    const loadWorkflowRequest = vi.fn().mockResolvedValue(buildWorkflowRead(8))
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })

    await expect(workflow.loadWorkflow(7)).resolves.toBe(false)

    expect(workflow.workflowRead.value).toBeNull()
    expect(workflow.error.value).toContain('could not load the library workflow')
  })

  it('does not let an older library response replace the current selection', async () => {
    let resolveFirstRequest
    const firstRequest = new Promise(resolve => {
      resolveFirstRequest = resolve
    })
    const loadWorkflowRequest = vi.fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(buildWorkflowRead(8))
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })

    const firstLoad = workflow.loadWorkflow(7)
    await expect(workflow.loadWorkflow(8)).resolves.toBe(true)
    resolveFirstRequest(buildWorkflowRead(7))

    await expect(firstLoad).resolves.toBe(false)
    expect(workflow.workflowRead.value.library.id).toBe(8)
    expect(workflow.loading.value).toBe(false)
  })

  it('watches library changes through the same bounded request path', async () => {
    const libraryId = ref(null)
    const loadWorkflowRequest = vi.fn().mockResolvedValue(buildWorkflowRead(8))
    const workflow = usePolicyOperatorWorkflow({ loadWorkflowRequest })
    const stopWatching = workflow.watchWorkflow(libraryId)

    libraryId.value = 8
    await vi.waitFor(() => expect(loadWorkflowRequest).toHaveBeenCalledWith(8))

    expect(workflow.workflowRead.value.library.id).toBe(8)
    stopWatching()
  })

  it('accepts a server-validated custom signal only through the display-only workflow projection', async () => {
    const customWorkflowRead = buildWorkflowRead()
    customWorkflowRead.observedProfile.intentSignalProjection.options = [{
      candidateId: 'intent-signal:operator-added-custom:studios:studio-ghibli',
      sourceId: 'operator_added_custom',
      sourceLabel: 'Custom value',
      signalType: 'studios',
      value: 'Studio Ghibli',
      label: 'Studio Ghibli',
      questionId: 'what_belongs_here',
      selectionStateId: 'selectable_custom_value',
      selectable: true,
      readOnlyEvidence: false,
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
      explanation: 'This library is intended for films from this studio.',
      evidence: { count: 0, confidence: null },
      operator: 'require_any',
      commandId: 'add_signal_value',
    }]
    const loadWorkflowRequest = vi.fn().mockResolvedValue(buildWorkflowRead())
    const validateCustomIntentSignalRequest = vi.fn().mockResolvedValue({ data: customWorkflowRead })
    const workflow = usePolicyOperatorWorkflow({
      loadWorkflowRequest,
      validateCustomIntentSignalRequest,
    })
    const payload = {
      signalType: 'studios',
      value: 'Studio Ghibli',
      explanation: 'This library is intended for films from this studio.',
    }

    await workflow.loadWorkflow(7)
    await expect(workflow.validateCustomIntentSignal(7, payload)).resolves.toBe(true)

    expect(validateCustomIntentSignalRequest).toHaveBeenCalledWith(7, payload)
    expect(workflow.workflowRead.value).toEqual(customWorkflowRead)
    expect(workflow.customIntentSignalValidationMessage.value).toContain('Review it below')
    expect(workflow.customIntentSignalValidationError.value).toBe('')
  })

  it('fails closed when custom validation returns a workflow for another library', async () => {
    const loadWorkflowRequest = vi.fn().mockResolvedValue(buildWorkflowRead(7))
    const validateCustomIntentSignalRequest = vi.fn().mockResolvedValue({ data: buildWorkflowRead(8) })
    const workflow = usePolicyOperatorWorkflow({
      loadWorkflowRequest,
      validateCustomIntentSignalRequest,
    })

    await workflow.loadWorkflow(7)
    await expect(workflow.validateCustomIntentSignal(7, {
      signalType: 'keywords',
      value: 'Holiday',
      explanation: 'This library is intended for holiday films.',
    })).resolves.toBe(false)

    expect(workflow.workflowRead.value).toEqual(buildWorkflowRead(7))
    expect(workflow.customIntentSignalValidationError.value).toContain('could not validate')
  })
})
