/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { nextTick, ref, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const isFocusable = element => (
  element instanceof HTMLElement &&
  !element.hidden &&
  element.getAttribute('aria-hidden') !== 'true' &&
  !element.hasAttribute('disabled')
)

const getFocusableElements = container => {
  if (!(container instanceof HTMLElement)) return []

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(isFocusable)
}

const focusElement = element => {
  element?.focus?.({ preventScroll: true })
}

/**
 * Keeps the shared modal reachable and predictable for keyboard users.
 * The caller owns visual state while this composable owns DOM focus only.
 */
export function useModalFocusManagement({
  isOpen,
  dialogRef,
  titleRef,
  restoreFocus,
}) {
  const returnFocusTarget = ref(null)

  const captureReturnFocusTarget = () => {
    if (typeof document === 'undefined') return

    const activeElement = document.activeElement
    returnFocusTarget.value = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null
  }

  const focusInitialTarget = async () => {
    await nextTick()
    if (!isOpen.value) return

    focusElement(titleRef.value || getFocusableElements(dialogRef.value)[0] || dialogRef.value)
  }

  const restorePreviousFocus = async () => {
    const target = returnFocusTarget.value
    returnFocusTarget.value = null

    await nextTick()
    if (!restoreFocus.value || !target?.isConnected) return

    focusElement(target)
  }

  const handleKeydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      return false
    }

    if (event.key !== 'Tab') return true

    const focusableElements = getFocusableElements(dialogRef.value)
    if (focusableElements.length === 0) {
      event.preventDefault()
      focusElement(dialogRef.value)
      return true
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)
    const activeElement = document.activeElement

    if (event.shiftKey && (activeElement === firstElement || !focusableElements.includes(activeElement))) {
      event.preventDefault()
      focusElement(lastElement)
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      focusElement(firstElement)
    }

    return true
  }

  watch(isOpen, async open => {
    if (open) {
      captureReturnFocusTarget()
      await focusInitialTarget()
      return
    }

    await restorePreviousFocus()
  }, { flush: 'post', immediate: true })

  return {
    handleKeydown,
  }
}
