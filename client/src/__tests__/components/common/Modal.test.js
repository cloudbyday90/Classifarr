/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Modal from '@/components/common/Modal.vue'

enableAutoUnmount(afterEach)

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
  it('disables dismissal while a caller-owned request is pending', async () => {
    const wrapper = buildModal({ closeDisabled: true })
    await nextTick()
    const dialog = document.querySelector('dialog')
    const close = dialog.querySelector('button')
    expect(close.disabled).toBe(true)
    close.click()
    dispatchKeydown(dialog, 'Escape')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ closeDisabled: false })
    close.click()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('keeps its parent authoritative and forwards dialog attributes without submitting', async () => {
    const wrapper = buildModal({ title: '', 'aria-label': 'Recovery options', 'aria-describedby': 'help' })
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeInstanceOf(HTMLDialogElement)
    expect(dialog.open).toBe(true)
    expect(dialog.hasAttribute('tabindex')).toBe(false)
    expect(dialog.getAttribute('aria-label')).toBe('Recovery options')
    expect(dialog.getAttribute('aria-describedby')).toBe('help')
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
    const close = dialog.querySelector('button')
    expect(close.type).toBe('button')
    expect(document.activeElement).toBe(close)
    close.click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(document.querySelector('[role="dialog"]')).toBe(dialog)
    expect(dialog.open).toBe(true)
  })

  it('prevents native cancellation until its parent accepts the close request', async () => {
    const wrapper = buildModal()
    await nextTick()
    const dialog = document.querySelector('dialog')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    await nextTick()
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    await wrapper.setProps({ modelValue: false })
    expect(dialog.isConnected).toBe(false)
  })

  it('allows a child to handle Escape and ignores composition or modified Tab', async () => {
    const wrapper = buildModal()
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')
    const button = dialog.querySelector('button')
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    handled.preventDefault()
    button.dispatchEvent(handled)
    dispatchKeydown(button, 'Escape', { isComposing: true })
    dispatchKeydown(button, 'Enter')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true, cancelable: true })
    button.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('enters from the title and traps only usable controls, recomputing each time', async () => {
    buildModal()
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')
    const [close, retry, last] = dialog.querySelectorAll('button')
    last.parentElement.insertAdjacentHTML('beforeend', '<div hidden><button>Hidden last</button></div>')
    dispatchKeydown(document.activeElement, 'Tab')
    expect(document.activeElement).toBe(close)
    last.disabled = true
    close.focus()
    dispatchKeydown(close, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(retry)
    close.disabled = true
    retry.disabled = true
    dispatchKeydown(dialog, 'Tab')
    expect(document.activeElement).toBe(dialog.querySelector('h3'))
  })

  it.each(['removed', 'hidden', 'disabled', 'inert'])('uses a caller-owned fallback when the opener is %s', async state => {
    const opener = document.createElement('button')
    const fallback = document.createElement('button')
    document.body.append(opener, fallback)
    opener.focus()
    const resolve = vi.fn(() => fallback)
    const wrapper = buildModal({ fallbackFocusTarget: resolve })
    await nextTick()
    if (state === 'removed') opener.remove()
    else opener.setAttribute(state, '')
    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.activeElement).toBe(fallback)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('never steals focus from a newly focused route or sibling dialog', async () => {
    const opener = document.createElement('button')
    const destination = document.createElement('button')
    document.body.append(opener, destination)
    opener.focus()
    const wrapper = buildModal()
    await nextTick()
    const closing = wrapper.setProps({ modelValue: false })
    destination.focus()
    await closing
    await nextTick()
    expect(document.activeElement).toBe(destination)
  })

  it('invalidates initial focus when unmounted before the next tick', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = buildModal()
    wrapper.unmount()
    await nextTick()
    expect(document.activeElement).toBe(opener)
  })

  it('restores focus when the open component is unmounted', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = buildModal()
    await nextTick()
    wrapper.unmount()
    await nextTick()
    expect(document.activeElement).toBe(opener)
  })

  it('does not return focus from a closing dialog into a newly opened one', async () => {
    const first = buildModal()
    const second = buildModal({ modelValue: false, title: 'Second dialog' })
    await nextTick()
    await Promise.all([first.setProps({ modelValue: false }), second.setProps({ modelValue: true })])
    await nextTick()
    expect(document.activeElement.textContent).toBe('Second dialog')
  })

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
