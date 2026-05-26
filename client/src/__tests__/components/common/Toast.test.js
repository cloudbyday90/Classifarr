/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Toast from '@/components/common/Toast.vue'
import { useToastStore } from '@/stores/toast'

let wrapper
let pinia

function mountToast() {
  wrapper = mount(Toast, {
    global: {
      plugins: [pinia],
      stubs: {
        teleport: { template: '<div><slot /></div>' },
        'transition-group': { template: '<div><slot /></div>' }
      }
    }
  })
  return wrapper
}

function getBodyText() {
  return wrapper.text()
}

function getBodyHtml() {
  return wrapper.html()
}

describe('Toast.vue', () => {
  let toastStore

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    vi.useFakeTimers()
    pinia = createPinia()
    setActivePinia(pinia)
    toastStore = useToastStore()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('shows no toasts initially', () => {
      mountToast()
      expect(getBodyText()).not.toContain('✅')
    })

    it('shows toast with message', async () => {
      mountToast()
      toastStore.addToast({ type: 'success', message: 'Saved!' })
      await flushPromises()

      expect(getBodyText()).toContain('Saved!')
    })

    it('shows toast with title and message', async () => {
      mountToast()
      toastStore.addToast({ type: 'error', title: 'Error', message: 'Failed to save' })
      await flushPromises()

      expect(getBodyText()).toContain('Error')
      expect(getBodyText()).toContain('Failed to save')
    })

    it('shows multiple toasts', async () => {
      mountToast()
      toastStore.addToast({ type: 'success', message: 'First' })
      toastStore.addToast({ type: 'info', message: 'Second' })
      await flushPromises()

      expect(getBodyText()).toContain('First')
      expect(getBodyText()).toContain('Second')
    })
  })

  describe('toast types and styling', () => {
    it('shows success icon for success type', async () => {
      mountToast()
      toastStore.addToast({ type: 'success', message: 'OK' })
      await flushPromises()

      expect(getBodyText()).toContain('✅')
    })

    it('shows error icon for error type', async () => {
      mountToast()
      toastStore.addToast({ type: 'error', message: 'Fail' })
      await flushPromises()

      expect(getBodyText()).toContain('❌')
    })

    it('shows warning icon for warning type', async () => {
      mountToast()
      toastStore.addToast({ type: 'warning', message: 'Careful' })
      await flushPromises()

      expect(getBodyText()).toContain('⚠️')
    })

    it('shows info icon for info type', async () => {
      mountToast()
      toastStore.addToast({ type: 'info', message: 'Note' })
      await flushPromises()

      expect(getBodyText()).toContain('ℹ️')
    })

    it('applies success classes for success type', async () => {
      mountToast()
      toastStore.addToast({ type: 'success', message: 'OK' })
      await flushPromises()

      expect(getBodyHtml()).toContain('bg-green-900')
    })

    it('applies error classes for error type', async () => {
      mountToast()
      toastStore.addToast({ type: 'error', message: 'Fail' })
      await flushPromises()

      expect(getBodyHtml()).toContain('bg-red-900')
    })

    it('applies warning classes for warning type', async () => {
      mountToast()
      toastStore.addToast({ type: 'warning', message: 'Careful' })
      await flushPromises()

      expect(getBodyHtml()).toContain('bg-yellow-900')
    })

    it('applies info classes for info type', async () => {
      mountToast()
      toastStore.addToast({ type: 'info', message: 'Note' })
      await flushPromises()

      expect(getBodyHtml()).toContain('bg-blue-900')
    })
  })

  describe('removal', () => {
    it('removes toast when close button is clicked', async () => {
      mountToast()
      toastStore.addToast({ type: 'success', message: 'Temporary', duration: 0 })
      await flushPromises()

      expect(getBodyText()).toContain('Temporary')

      const closeBtn = wrapper.find('button')
      expect(closeBtn.exists()).toBe(true)
      await closeBtn.trigger('click')
      await flushPromises()

      expect(getBodyText()).not.toContain('Temporary')
    })

    it('removes toast after duration expires', async () => {
      mountToast()
      toastStore.addToast({ type: 'info', message: 'Auto-remove', duration: 3000 })
      await flushPromises()

      expect(getBodyText()).toContain('Auto-remove')

      vi.advanceTimersByTime(3000)
      await flushPromises()

      expect(getBodyText()).not.toContain('Auto-remove')
    })

    it('does not auto-remove toast with duration 0', async () => {
      mountToast()
      toastStore.addToast({ type: 'info', message: 'Persistent', duration: 0 })
      await flushPromises()

      vi.advanceTimersByTime(10000)
      await flushPromises()

      expect(getBodyText()).toContain('Persistent')
    })
  })
})
