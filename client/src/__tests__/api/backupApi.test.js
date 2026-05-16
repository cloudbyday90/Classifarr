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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockGet = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  createBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  previewBackupFile,
} from '../../api/backupApi'

describe('backupApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createBackup calls POST with options', async () => {
    mockPost.mockResolvedValueOnce({ data: { filename: 'backup.zip' } })
    await createBackup({ includeSettings: true })
    expect(mockPost).toHaveBeenCalledWith('/backup/export', { includeSettings: true })
  })

  it('listBackups calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await listBackups()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/backup/list')
  })

  it('downloadBackup calls GET with blob responseType', async () => {
    mockGet.mockResolvedValueOnce({ data: new Blob() })
    await downloadBackup('backup.zip')
    expect(mockGet).toHaveBeenCalledWith('/backup/download/backup.zip', { responseType: 'blob' })
  })

  it('deleteBackup calls DELETE with filename', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deleteBackup('old-backup.zip')
    expect(mockDelete).toHaveBeenCalledWith('/backup/old-backup.zip')
  })

  it('restoreBackup calls POST with filename, password, mode', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await restoreBackup('backup.zip', 'secret', 'merge')
    expect(mockPost).toHaveBeenCalledWith('/backup/import', { filename: 'backup.zip', password: 'secret', mode: 'merge' })
  })

  it('previewBackupFile calls POST with filename and password', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await previewBackupFile('backup.zip', 'secret')
    expect(mockPost).toHaveBeenCalledWith('/backup/preview', { filename: 'backup.zip', password: 'secret' })
  })
})
