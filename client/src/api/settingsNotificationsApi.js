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

export function updateNotificationsConfig(data) {
  return apiClient.put('/settings/notifications', data)
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
  getNotificationsConfig,
  updateNotificationsConfig,
  getDiscordChannelDetails,
  getDiscordServers,
  getDiscordChannels,
  getDiscordMentionTargets,
  testDiscord,
}

export default settingsNotificationsApi
