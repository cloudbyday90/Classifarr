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

import { afterEach, describe, expect, it } from 'vitest'
import { CSRF_COOKIE_NAME, getCookieValue, getCsrfToken } from '@/utils/csrf'

describe('csrf utilities', () => {
  afterEach(() => {
    document.cookie = 'classifarr_csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
    document.cookie = 'other_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
    document.cookie = 'encode%20test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
  })

  it('getCookieValue returns null when document.cookie is empty', () => {
    expect(getCookieValue('anything')).toBeNull()
  })

  it('getCookieValue finds a cookie by exact name', () => {
    document.cookie = 'session=abc123'

    expect(getCookieValue('session')).toBe('abc123')
  })

  it('getCookieValue returns null for a missing cookie', () => {
    document.cookie = 'session=abc123'

    expect(getCookieValue('nonexistent')).toBeNull()
  })

  it('getCookieValue handles multiple cookies', () => {
    document.cookie = 'theme=dark'
    document.cookie = 'lang=en'

    expect(getCookieValue('theme')).toBe('dark')
    expect(getCookieValue('lang')).toBe('en')
  })

  it('getCookieValue handles URL-encoded names and values', () => {
    document.cookie = 'encode%20test=value%20here'

    expect(getCookieValue('encode test')).toBe('value here')
  })

  it('getCsrfToken returns the CSRF cookie using the correct name', () => {
    document.cookie = 'classifarr_csrf_token=tkn-789'

    expect(getCsrfToken()).toBe('tkn-789')
    expect(CSRF_COOKIE_NAME).toBe('classifarr_csrf_token')
  })
})
