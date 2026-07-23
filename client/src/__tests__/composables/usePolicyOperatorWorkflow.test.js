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
})
