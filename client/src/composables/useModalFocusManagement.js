/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { nextTick, onBeforeUnmount, watch } from 'vue'
import { focusAvailableTarget, getModalTabStops } from '@/utils/modalFocusTargets.js'

/**
 * @param {{
 *   isOpen: import('vue').ComputedRef<boolean>,
 *   dialogRef: Readonly<import('vue').Ref<HTMLDialogElement | null>>,
 *   titleRef: Readonly<import('vue').Ref<HTMLElement | null>>,
 *   restoreFocus: import('vue').ComputedRef<boolean>,
 *   fallbackFocusTarget: () => HTMLElement | null,
 * }} options
 */
export function useModalFocusManagement({
  isOpen,
  dialogRef,
  titleRef,
  restoreFocus,
  fallbackFocusTarget,
}) {
  /** @type {HTMLElement | null} */
  let returnTarget = null
  /** @type {HTMLElement | null} */
  let openedDialog = null
  let generation = 0
  let disposed = false

  const restorePreviousFocus = () => {
    const target = returnTarget
    const previousDialog = openedDialog
    returnTarget = null
    openedDialog = null
    if (!restoreFocus.value || !previousDialog) return
    const active = previousDialog.ownerDocument.activeElement
    // A route handoff or another dialog already owns focus: do not steal it.
    if (active !== previousDialog.ownerDocument.body && !previousDialog.contains(active)) return
    if (!focusAvailableTarget(target)) focusAvailableTarget(fallbackFocusTarget())
  }

  watch(isOpen, async open => {
    const revision = ++generation
    if (open && typeof document !== 'undefined') {
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== document.body && !openedDialog?.contains(active)) {
        returnTarget = active
      }
    }
    await nextTick()
    if (disposed || revision !== generation) return
    if (!open) {
      restorePreviousFocus()
      return
    }
    const dialog = dialogRef.value
    if (!dialog?.isConnected) return
    openedDialog = dialog
    dialog.showModal()
    if (focusAvailableTarget(titleRef.value)) return
    for (const target of getModalTabStops(openedDialog)) {
      if (focusAvailableTarget(target)) return
    }
    focusAvailableTarget(openedDialog)
  }, { flush: 'sync', immediate: true })

  onBeforeUnmount(() => {
    disposed = true
    generation++
    // Vue removes the native dialog (and its top-layer entry) synchronously.
    // Calling close() instead would force the browser's opener-focus return,
    // even when this instance explicitly opts out for a route handoff.
    // Allow the parent's next view to establish focus before considering return.
    void nextTick().then(restorePreviousFocus)
  })

  /** @param {KeyboardEvent} event */
  const handleKeydown = event => {
    if (!isOpen.value || event.defaultPrevented || event.isComposing) return true
    const dialog = dialogRef.value
    if (!dialog || !(event.target instanceof Element) || event.target.closest('[role="dialog"]') !== dialog) return true
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return true
    const stops = getModalTabStops(dialog)
    const active = dialog.ownerDocument.activeElement
    const boundary = event.shiftKey ? stops[0] : stops.at(-1)
    if (active === boundary || !stops.some(stop => stop === active)) {
      event.preventDefault()
      const ordered = event.shiftKey ? [...stops].reverse() : stops
      if (!ordered.some(focusAvailableTarget) && !focusAvailableTarget(titleRef.value)) focusAvailableTarget(dialog)
    }
    return true
  }

  return {
    handleKeydown,
  }
}
