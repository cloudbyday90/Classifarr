import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPatch = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    patch: (...args) => mockPatch(...args),
  },
}))

import {
  getUserProfile,
  updateUserProfile,
  updatePassword,
  getSessionInfo,
} from '../../api/userApi'

describe('userApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUserProfile calls getDataRequest with /user/me', async () => {
    const profile = { username: 'admin', role: 'admin' }
    mockGetDataRequest.mockResolvedValueOnce(profile)
    const result = await getUserProfile()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/user/me')
    expect(result).toEqual(profile)
  })

  it('updateUserProfile calls PATCH with data', async () => {
    const data = { username: 'newadmin' }
    mockPatch.mockResolvedValueOnce({ data: { success: true } })
    await updateUserProfile(data)
    expect(mockPatch).toHaveBeenCalledWith('/user/profile', data)
  })

  it('updatePassword calls PATCH with password data', async () => {
    const data = { currentPassword: 'old', newPassword: 'new', confirmPassword: 'new' }
    mockPatch.mockResolvedValueOnce({ data: { success: true } })
    await updatePassword(data)
    expect(mockPatch).toHaveBeenCalledWith('/user/password', data)
  })

  it('getSessionInfo calls getDataRequest with /auth/session', async () => {
    const session = { token: 'abc', expiresAt: '2026-01-01' }
    mockGetDataRequest.mockResolvedValueOnce(session)
    const result = await getSessionInfo()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/auth/session')
    expect(result).toEqual(session)
  })
})
