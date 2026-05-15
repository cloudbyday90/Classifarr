import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}))

import {
  getMediaServerConfig,
  getArrConfigStatus,
  getSetupStatus,
  getSetupWizardStatus,
  getHeartbeatSettings,
  updateHeartbeatSettings,
  getSystemHeartbeat,
  updateMediaServerConfig,
  testMediaServerConnection,
  syncMediaServer,
  triggerIngestion,
  getMediaServers,
} from '../../api/mediaServerSetupApi'

describe('mediaServerSetupApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMediaServerConfig calls getDataRequest with /media-server', async () => {
    const config = { name: 'Plex', url: 'http://plex:32400' }
    mockGetDataRequest.mockResolvedValueOnce(config)
    const result = await getMediaServerConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/media-server')
    expect(result).toEqual(config)
  })

  it('getArrConfigStatus calls getDataRequest with correct URL', async () => {
    const status = { radarr: true, sonarr: false }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getArrConfigStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/arr-config-status')
    expect(result).toEqual(status)
  })

  it('getSetupStatus calls getDataRequest with /setup/status', async () => {
    const status = { complete: true }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getSetupStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/setup/status')
    expect(result).toEqual(status)
  })

  it('getSetupWizardStatus calls getDataRequest with correct URL', async () => {
    const status = { step: 3 }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getSetupWizardStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/setup-status')
    expect(result).toEqual(status)
  })

  it('getHeartbeatSettings calls getDataRequest with correct URL', async () => {
    const settings = { interval: 30, enabled: true }
    mockGetDataRequest.mockResolvedValueOnce(settings)
    const result = await getHeartbeatSettings()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/heartbeat')
    expect(result).toEqual(settings)
  })

  it('updateHeartbeatSettings calls PUT with data', async () => {
    const data = { interval: 60 }
    mockPut.mockResolvedValueOnce({ data: { ok: true } })
    const result = await updateHeartbeatSettings(data)
    expect(mockPut).toHaveBeenCalledWith('/settings/heartbeat', data)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('getSystemHeartbeat calls getDataRequest with correct URL', async () => {
    const heartbeat = { alive: true, uptime: 5000 }
    mockGetDataRequest.mockResolvedValueOnce(heartbeat)
    const result = await getSystemHeartbeat()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/heartbeat')
    expect(result).toEqual(heartbeat)
  })

  it('updateMediaServerConfig calls POST with config', async () => {
    const config = { name: 'Jellyfin', url: 'http://jellyfin:8096' }
    mockPost.mockResolvedValueOnce({ data: { saved: true } })
    const result = await updateMediaServerConfig(config)
    expect(mockPost).toHaveBeenCalledWith('/media-server', config)
    expect(result).toEqual({ data: { saved: true } })
  })

  it('testMediaServerConnection calls POST with config', async () => {
    const config = { url: 'http://plex:32400', token: 'abc' }
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await testMediaServerConnection(config)
    expect(mockPost).toHaveBeenCalledWith('/media-server/test', config)
    expect(result).toEqual({ data: { success: true } })
  })

  it('syncMediaServer calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { syncing: true } })
    const result = await syncMediaServer()
    expect(mockPost).toHaveBeenCalledWith('/media-server/sync')
    expect(result).toEqual({ data: { syncing: true } })
  })

  it('triggerIngestion calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { ingesting: true } })
    const result = await triggerIngestion()
    expect(mockPost).toHaveBeenCalledWith('/media-server/ingest')
    expect(result).toEqual({ data: { ingesting: true } })
  })

  it('getMediaServers wraps single config response in array', async () => {
    const config = { name: 'Plex' }
    mockGetDataRequest.mockResolvedValueOnce(config)
    const result = await getMediaServers()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/media-server')
    expect(result).toEqual([config])
  })

  it('getMediaServers returns empty array when config is falsy', async () => {
    mockGetDataRequest.mockResolvedValueOnce(null)
    const result = await getMediaServers()
    expect(result).toEqual([])
  })
})
