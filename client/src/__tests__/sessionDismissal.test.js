/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissForSession, isSessionDismissed } from '../utils/sessionDismissal'

const key = 'fixture.notice'
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })

describe('best-effort session dismissal', () => {
  it('stores only the marker at the supplied key', () => {
    expect(isSessionDismissed(key)).toBe(false)
    expect(dismissForSession(key)).toBe(true)
    expect(isSessionDismissed(key)).toBe(true)
    expect(sessionStorage.getItem(key)).toBe('true')
    expect(sessionStorage.length).toBe(1)
  })
  it.each(['false', '1', 'TRUE', '{}', ''])('does not interpret %j as consent to hide', value => {
    sessionStorage.setItem(key, value)
    expect(isSessionDismissed(key)).toBe(false)
  })
  it('catches access to the storage property itself', () => {
    vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    expect(isSessionDismissed(key)).toBe(false)
    expect(dismissForSession(key)).toBe(false)
  })
  it('catches a failed read', () => {
    const read = vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(isSessionDismissed(key)).toBe(false)
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
  })
  it('catches a failed write without claiming persistence', () => {
    const write = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(dismissForSession(key)).toBe(false)
    expect(write).toHaveBeenCalledExactlyOnceWith(key, 'true')
    expect(isSessionDismissed(key)).toBe(false)
  })
})
