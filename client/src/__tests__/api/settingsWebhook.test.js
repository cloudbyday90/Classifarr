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
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getWebhookConfig,
  updateWebhookConfig,
  generateWebhookKey,
  getWebhookSecret,
  getWebhookLogs,
  getWebhookStats,
  testWebhook,
  getWebhookConfigs,
  createWebhookConfig,
  deleteWebhookConfig,
  setPrimaryWebhookConfig,
} from '../../api/settingsWebhook'

describe('settingsWebhookApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getWebhookConfig calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ url: 'https://example.com' })
    await getWebhookConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/webhook')
  })

  it('updateWebhookConfig calls PUT', async () => {
    mockPut.mockResolvedValueOnce({ data: {} })
    await updateWebhookConfig({ url: 'https://new.com' })
    expect(mockPut).toHaveBeenCalledWith('/settings/webhook', { url: 'https://new.com' })
  })

  it('generateWebhookKey calls POST', async () => {
    mockPost.mockResolvedValueOnce({ data: { key: 'abc' } })
    await generateWebhookKey()
    expect(mockPost).toHaveBeenCalledWith('/settings/webhook/generate-key')
  })

  it('getWebhookSecret calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ secret: 's' })
    await getWebhookSecret()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/webhook/secret')
  })

  it('getWebhookLogs passes params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getWebhookLogs({ limit: 20 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/webhook/logs', { params: { limit: 20 } })
  })

  it('getWebhookStats calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ total: 100 })
    await getWebhookStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/webhook/stats')
  })

  it('testWebhook calls POST', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testWebhook()
    expect(mockPost).toHaveBeenCalledWith('/settings/webhook/test')
  })

  it('getWebhookConfigs calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getWebhookConfigs()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/webhook/configs')
  })

  it('createWebhookConfig calls POST with data', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 1 } })
    await createWebhookConfig({ url: 'https://hook.com' })
    expect(mockPost).toHaveBeenCalledWith('/settings/webhook/configs', { url: 'https://hook.com' })
  })

  it('deleteWebhookConfig calls DELETE with id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deleteWebhookConfig(5)
    expect(mockDelete).toHaveBeenCalledWith('/settings/webhook/configs/5')
  })

  it('setPrimaryWebhookConfig calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await setPrimaryWebhookConfig(3)
    expect(mockPost).toHaveBeenCalledWith('/settings/webhook/configs/3/primary')
  })
})
