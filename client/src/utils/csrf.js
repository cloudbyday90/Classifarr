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

export const CSRF_COOKIE_NAME = 'classifarr_csrf_token'

/**
 * Reads a single cookie value by name from document.cookie.
 * Returns null when running outside a browser context or when the cookie is absent.
 */
export function getCookieValue(name) {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const cookies = document.cookie.split(';')

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim()
    if (cookie.startsWith(encodedName)) {
      return decodeURIComponent(cookie.substring(encodedName.length))
    }
  }

  return null
}

/** Returns the current CSRF token from the session cookie, or null if absent. */
export function getCsrfToken() {
  return getCookieValue(CSRF_COOKIE_NAME)
}
