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
