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

import { apiClient } from './core'

export function getWebhookConfig() {
  return apiClient.get('/settings/webhook')
}

export function updateWebhookConfig(config) {
  return apiClient.put('/settings/webhook', config)
}

export function generateWebhookKey() {
  return apiClient.post('/settings/webhook/generate-key')
}

export function getWebhookSecret() {
  return apiClient.get('/settings/webhook/secret')
}

export function getWebhookLogs(params) {
  return apiClient.get('/settings/webhook/logs', { params })
}

export function getWebhookStats() {
  return apiClient.get('/settings/webhook/stats')
}

export function testWebhook() {
  return apiClient.post('/settings/webhook/test')
}

export function getWebhookConfigs() {
  return apiClient.get('/settings/webhook/configs')
}

export function createWebhookConfig(config) {
  return apiClient.post('/settings/webhook/configs', config)
}

export function deleteWebhookConfig(id) {
  return apiClient.delete(`/settings/webhook/configs/${id}`)
}

export function setPrimaryWebhookConfig(id) {
  return apiClient.post(`/settings/webhook/configs/${id}/primary`)
}

const settingsWebhookApi = {
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
}

export default settingsWebhookApi
