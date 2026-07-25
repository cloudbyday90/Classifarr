/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePolicyRecoveryFocus } from '@/composables/usePolicyRecoveryFocus'

function createRecoveryAction() {
  const action = document.createElement('button')
  action.type = 'button'
  action.textContent = 'Retry recovery'
  document.body.append(action)
  return action
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('usePolicyRecoveryFocus', () => {
  it('returns focus to the completed recovery action when it remains available', async () => {
    const action = createRecoveryAction()
    const focusRecoveryStatus = vi.fn()
    const { captureRecoveryFocus, restoreRecoveryFocus } = usePolicyRecoveryFocus({
      workflowShellRef: ref({ focusRecoveryStatus }),
    })

    action.focus()
    const trigger = captureRecoveryFocus()
    document.body.focus()

    await restoreRecoveryFocus(trigger)

    expect(document.activeElement).toBe(action)
    expect(focusRecoveryStatus).not.toHaveBeenCalled()
  })

  it('focuses the workflow result only when the completed action no longer exists', async () => {
    const action = createRecoveryAction()
    const focusRecoveryStatus = vi.fn()
    const { captureRecoveryFocus, restoreRecoveryFocus } = usePolicyRecoveryFocus({
      workflowShellRef: ref({ focusRecoveryStatus }),
    })

    action.focus()
    const trigger = captureRecoveryFocus()
    action.remove()
    document.body.focus()

    await restoreRecoveryFocus(trigger)

    expect(focusRecoveryStatus).toHaveBeenCalledTimes(1)
  })

  it('does not override a focus target the operator selected while recovery ran', async () => {
    const action = createRecoveryAction()
    const otherAction = document.createElement('button')
    otherAction.type = 'button'
    otherAction.textContent = 'Close dialog'
    document.body.append(otherAction)
    const focusRecoveryStatus = vi.fn()
    const { captureRecoveryFocus, restoreRecoveryFocus } = usePolicyRecoveryFocus({
      workflowShellRef: ref({ focusRecoveryStatus }),
    })

    action.focus()
    const trigger = captureRecoveryFocus()
    otherAction.focus()

    await restoreRecoveryFocus(trigger)

    expect(document.activeElement).toBe(otherAction)
    expect(focusRecoveryStatus).not.toHaveBeenCalled()
  })
})
