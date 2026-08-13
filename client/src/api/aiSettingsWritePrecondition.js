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

const AI_SETTINGS_WRITE_PRECONDITION_HEADER = 'if-match'

export const AI_SETTINGS_STALE_WRITE_CODE = 'ai_settings_stale_write'
export const AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE = 'ai_settings_write_precondition_required'
export const AI_SETTINGS_STALE_WRITE_RECOVERY_MESSAGE =
  'AI settings changed before this save. Current settings were reloaded; review them and save again.'

function readHeader(headers, name) {
  if (!headers) return null
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase())
  }

  const expectedName = name.toLowerCase()
  const matchingEntry = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === expectedName,
  )
  return matchingEntry?.[1] || null
}

export function getAiSettingsWritePreconditionFromResponse(response) {
  const precondition = readHeader(response?.headers, 'etag')
  return typeof precondition === 'string' && precondition.length > 0 ? precondition : null
}

export function buildAiSettingsWritePreconditionRequestOptions(writePrecondition) {
  return writePrecondition
    ? { headers: { [AI_SETTINGS_WRITE_PRECONDITION_HEADER]: writePrecondition } }
    : undefined
}

export function isAiSettingsStaleWriteError(error) {
  const code = error?.response?.data?.code
  return code === AI_SETTINGS_STALE_WRITE_CODE
    || code === AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE
}
