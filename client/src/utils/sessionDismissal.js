/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Best-effort UI preference only, never an authorization or recovery decision.
 * @param {string} key
 * @returns {boolean}
 */
export function isSessionDismissed(key) {
  try {
    return globalThis.sessionStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/** @param {string} key @returns {boolean} Whether persistence succeeded. */
export function dismissForSession(key) {
  try {
    globalThis.sessionStorage.setItem(key, 'true')
    return true
  } catch {
    return false
  }
}
