/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Native backdrop events target the dialog. Require both ends of the gesture
 * outside its border box so dragging from a form control cannot dismiss it.
 * @param {Readonly<import('vue').Ref<HTMLDialogElement | null>>} dialogRef
 * @param {() => void} requestClose
 */
export function useModalDismissal(dialogRef, requestClose) {
  let startedOutside = false

  /** @param {MouseEvent} event */
  const isOutside = event => {
    const dialog = dialogRef.value
    if (!dialog || event.target !== dialog) return false
    const { left, right, top, bottom } = dialog.getBoundingClientRect()
    return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
  }

  /** @param {Event} event */
  const onCancel = event => {
    // Keep the parent's model authoritative, including rejected close requests.
    event.preventDefault()
    requestClose()
  }

  /** @param {PointerEvent} event */
  const onPointerdown = event => {
    startedOutside = event.button === 0 && isOutside(event)
  }

  const onPointercancel = () => { startedOutside = false }

  /** @param {MouseEvent} event */
  const onBackdropClick = event => {
    const dismiss = startedOutside && event.button === 0 && isOutside(event)
    startedOutside = false
    if (dismiss) requestClose()
  }

  return { onCancel, onPointerdown, onPointercancel, onBackdropClick }
}
