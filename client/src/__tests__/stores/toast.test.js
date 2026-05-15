/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast'

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addToast creates a toast with all properties and returns unique id', () => {
    const store = useToastStore()

    const id1 = store.addToast({ type: 'success', title: 'Saved', message: 'Settings saved', duration: 0 })
    const id2 = store.addToast({ type: 'error', message: 'Failed', duration: 3000 })

    expect(id1).toBe(1)
    expect(id2).toBe(2)
    expect(store.toasts).toHaveLength(2)
    expect(store.toasts[0]).toEqual({ id: 1, type: 'success', title: 'Saved', message: 'Settings saved' })
    expect(store.toasts[1]).toEqual({ id: 2, type: 'error', title: '', message: 'Failed' })
  })

  it('convenience methods pass the correct type', () => {
    const store = useToastStore()

    store.success('ok')
    store.error('bad')
    store.warning('careful')
    store.info('fyi')

    expect(store.toasts.map(t => t.type)).toEqual(['success', 'error', 'warning', 'info'])
    expect(store.toasts.map(t => t.message)).toEqual(['ok', 'bad', 'careful', 'fyi'])
  })

  it('removeToast removes a toast by id', () => {
    const store = useToastStore()

    const id = store.addToast({ message: 'hello', duration: 0 })
    expect(store.toasts).toHaveLength(1)

    store.removeToast(id)
    expect(store.toasts).toHaveLength(0)
  })

  it('removeToast ignores non-existent ids without error', () => {
    const store = useToastStore()

    store.addToast({ message: 'exists', duration: 0 })
    store.removeToast(999)

    expect(store.toasts).toHaveLength(1)
  })

  it('addToast auto-removes after the specified duration', () => {
    const store = useToastStore()

    store.addToast({ message: 'temporary', duration: 5000 })
    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })

  it('addToast with duration=0 keeps the toast persistent', () => {
    const store = useToastStore()

    store.addToast({ message: 'sticky', duration: 0 })
    vi.advanceTimersByTime(60000)

    expect(store.toasts).toHaveLength(1)
  })
})
