/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, it, vi } from 'vitest'
import { createBrowserRequestId } from '@/utils/browserRequestId'

afterEach(() => vi.unstubAllGlobals())

it('creates UUIDv4 from secure random bytes without randomUUID', () => {
  const getRandomValues = vi.fn(bytes => bytes.set(Array.from({ length: 16 }, (_, index) => index)))
  vi.stubGlobal('crypto', { getRandomValues })
  expect(createBrowserRequestId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  expect(getRandomValues).toHaveBeenCalledOnce()
})

it('fails closed without a secure random source', () => {
  vi.stubGlobal('crypto', undefined)
  expect(() => createBrowserRequestId()).toThrow('Secure browser randomness is unavailable')
})
