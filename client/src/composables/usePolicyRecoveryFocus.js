/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { nextTick } from 'vue'

const isConnectedEnabledElement = element => (
  element instanceof HTMLElement &&
  element.isConnected &&
  !element.hasAttribute('disabled')
)

const focusElement = element => {
  element?.focus?.({ preventScroll: true })
}

/**
 * Restores a recovery action only when an async update has otherwise lost focus.
 * It deliberately never moves focus away from an operator-selected destination.
 */
export function usePolicyRecoveryFocus({ workflowShellRef }) {
  const captureRecoveryFocus = () => {
    if (typeof document === 'undefined') return null

    return document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null
  }

  const restoreRecoveryFocus = async (trigger) => {
    if (!trigger) return

    await nextTick()

    const activeElement = document.activeElement
    const focusWasMovedDeliberately = activeElement &&
      activeElement !== document.body &&
      activeElement !== trigger

    if (focusWasMovedDeliberately) return

    if (isConnectedEnabledElement(trigger)) {
      focusElement(trigger)
      return
    }

    workflowShellRef.value?.focusRecoveryStatus?.()
  }

  return {
    captureRecoveryFocus,
    restoreRecoveryFocus,
  }
}
