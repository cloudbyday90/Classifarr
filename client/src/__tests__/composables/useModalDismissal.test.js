/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useModalDismissal } from '@/composables/useModalDismissal'

const setup = () => {
  const dialog = document.createElement('dialog')
  dialog.getBoundingClientRect = () => ({ left: 20, right: 80, top: 20, bottom: 80 })
  const close = vi.fn()
  const dialogRef = ref(dialog)
  const handlers = useModalDismissal(dialogRef, close)
  const outside = { target: dialog, clientX: 5, clientY: 5, button: 0 }
  const inside = { ...outside, clientX: 50, clientY: 50 }
  return { ...handlers, dialogRef, close, outside, inside }
}

describe('native modal dismissal', () => {
  it('closes once for an outside gesture and resets after delivery', () => {
    const test = setup()
    test.onPointerdown(test.outside)
    test.onBackdropClick(test.outside)
    test.onBackdropClick(test.outside)
    expect(test.close).toHaveBeenCalledTimes(1)
  })

  it.each(['drag-out', 'drag-in', 'cancel', 'secondary', 'child', 'disconnected'])('does not dismiss on %s', mode => {
    const test = setup()
    const start = mode === 'drag-out' ? test.inside : test.outside
    test.onPointerdown(mode === 'secondary' ? { ...start, button: 2 } : start)
    if (mode === 'cancel') test.onPointercancel()
    if (mode === 'disconnected') test.dialogRef.value = null
    const end = mode === 'drag-in' ? test.inside : test.outside
    test.onBackdropClick(mode === 'child' ? { ...end, target: document.createElement('button') } : end)
    expect(test.close).not.toHaveBeenCalled()
  })
})
