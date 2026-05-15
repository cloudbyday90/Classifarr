import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPut = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    put: (...args) => mockPut(...args),
  },
}))

import {
  getGeneralSettings,
  updateGeneralSettings,
} from '../../api/settingsGeneralApi'

describe('settingsGeneralApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getGeneralSettings calls getDataRequest with /settings', async () => {
    const settings = { app_name: 'Classifarr', theme: 'dark' }
    mockGetDataRequest.mockResolvedValueOnce(settings)
    const result = await getGeneralSettings()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings')
    expect(result).toEqual(settings)
  })

  it('updateGeneralSettings calls PUT with data', async () => {
    const data = { app_name: 'MyApp', theme: 'light' }
    mockPut.mockResolvedValueOnce({ data: { success: true } })
    const result = await updateGeneralSettings(data)
    expect(mockPut).toHaveBeenCalledWith('/settings', data)
    expect(result).toEqual({ data: { success: true } })
  })
})
