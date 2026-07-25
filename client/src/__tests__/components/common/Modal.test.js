/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Modal from '@/components/common/Modal.vue'

const buildModal = props => mount(Modal, {
  attachTo: document.body,
  props: {
    modelValue: true,
    title: 'Recovery workflow',
    ...props,
  },
  slots: {
    default: [
      '<button type="button">Retry recovery</button>',
      '<button type="button">Continue setup</button>',
    ].join(''),
  },
})

const dispatchKeydown = (element, key, options = {}) => {
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Modal.vue', () => {
  it('exposes modal semantics and gives large dialog content an orienting focus target', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open recovery workflow'
    document.body.append(opener)
    opener.focus()

    buildModal()
    await nextTick()

    const dialog = document.body.querySelector('[role="dialog"]')
    const title = dialog.querySelector('h3')

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
    expect(title.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(title)
  })

  it('cycles keyboard focus inside the modal and closes with Escape', async () => {
    const wrapper = buildModal()
    await nextTick()

    const dialog = document.body.querySelector('[role="dialog"]')
    const buttons = dialog.querySelectorAll('button')
    const [closeButton, retryButton, continueButton] = buttons

    continueButton.focus()
    dispatchKeydown(continueButton, 'Tab')
    expect(document.activeElement).toBe(closeButton)

    closeButton.focus()
    dispatchKeydown(closeButton, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(continueButton)

    retryButton.focus()
    dispatchKeydown(retryButton, 'Escape')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('returns focus to its invoking control after a normal close', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open recovery workflow'
    document.body.append(opener)
    opener.focus()

    const wrapper = buildModal()
    await nextTick()
    await wrapper.setProps({ modelValue: false })
    await nextTick()

    expect(document.activeElement).toBe(opener)
  })

  it('can suppress focus restoration when a completed dialog action moves to a new route', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open recovery workflow'
    document.body.append(opener)
    opener.focus()

    const wrapper = buildModal({ restoreFocus: false })
    await nextTick()
    await wrapper.setProps({ modelValue: false })
    await nextTick()

    expect(document.activeElement).not.toBe(opener)
  })
})
