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
  getNotificationsConfig,
  updateNotificationsConfig,
  getDiscordChannelDetails,
  getDiscordServers,
  getDiscordChannels,
  testDiscord,
} from '../../api/settingsNotificationsApi'

describe('settingsNotificationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getNotificationsConfig calls getDataRequest with correct URL', async () => {
    const config = { bot_token: 'tok', channel_id: '123' }
    mockGetDataRequest.mockResolvedValueOnce(config)
    const result = await getNotificationsConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/notifications')
    expect(result).toEqual(config)
  })

  it('updateNotificationsConfig calls PUT with data', async () => {
    const data = { bot_token: 'tok', enabled: true }
    mockPut.mockResolvedValueOnce({ data: { success: true } })
    await updateNotificationsConfig(data)
    expect(mockPut).toHaveBeenCalledWith('/settings/notifications', data)
  })

  it('getDiscordChannelDetails calls getDataRequest with channel id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ name: 'general' })
    await getDiscordChannelDetails('ch1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/discord/channel/ch1')
  })

  it('getDiscordServers calls getDataRequest with bot token param', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 's1', name: 'My Server' }])
    await getDiscordServers('bot-token')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/discord/servers', { params: { bot_token: 'bot-token' } })
  })

  it('getDiscordChannels calls getDataRequest with server id and bot token', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 'c1', name: 'general' }])
    await getDiscordChannels('s1', 'bot-token')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/discord/channels/s1', { params: { bot_token: 'bot-token' } })
  })

  it('testDiscord calls POST with data', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testDiscord({ bot_token: 'tok' })
    expect(mockPost).toHaveBeenCalledWith('/settings/discord/test', { bot_token: 'tok' })
  })
})
