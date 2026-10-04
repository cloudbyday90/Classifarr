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

import { apiClient, getDataRequest } from './core'

export function getNotificationsConfig() {
  return getDataRequest('/settings/notifications')
}

/**
 * Returns saved receipt status, including retryQueued (not a promise of delivery).
 * @param {string | null} [before]
 * @param {AbortSignal} [signal]
 */
export function getDiscordDeliveries(before = null, signal = undefined) {
  return getDataRequest('/settings/discord/deliveries', {
    params: before ? { before } : {}, signal,
    timeout: 10_000, skipAutomaticRetry: true,
  })
}

export function updateNotificationsConfig(data) {
  return apiClient.put('/settings/notifications', data)
}

/** @param {string} classificationId @param {string} messageId @param {AbortSignal} [signal] */
export function verifyDiscordDelivery(classificationId, messageId, signal = undefined) {
  return apiClient.post(`/settings/discord/deliveries/${classificationId}/verify`, { messageId }, {
    signal, timeout: 30_000, skipAutomaticRetry: true,
  })
}

export function getDiscordChannelDetails(channelId) {
  return getDataRequest(`/settings/discord/channel/${channelId}`)
}

export function getDiscordServers(botToken) {
  return getDataRequest('/settings/discord/servers', { params: { bot_token: botToken } })
}

export function getDiscordChannels(serverId, botToken) {
  return getDataRequest(`/settings/discord/channels/${serverId}`, { params: { bot_token: botToken } })
}

export function getDiscordMentionTargets(serverId, botToken) {
  return getDataRequest(`/settings/discord/mention-targets/${serverId}`, { params: { bot_token: botToken } })
}

export function testDiscord(data) {
  return apiClient.post('/settings/discord/test', data)
}

const settingsNotificationsApi = {
  getDiscordDeliveries,
  verifyDiscordDelivery,
  getNotificationsConfig,
  updateNotificationsConfig,
  getDiscordChannelDetails,
  getDiscordServers,
  getDiscordChannels,
  getDiscordMentionTargets,
  testDiscord,
}

export default settingsNotificationsApi
