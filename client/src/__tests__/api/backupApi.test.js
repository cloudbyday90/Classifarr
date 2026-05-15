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
