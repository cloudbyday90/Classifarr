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

export function getScheduledTasks() {
  return getDataRequest('/scheduler')
}

export function createScheduledTask(data) {
  return apiClient.post('/scheduler', data)
}

export function updateScheduledTask(id, data) {
  return apiClient.put(`/scheduler/${id}`, data)
}

export function deleteScheduledTask(id) {
  return apiClient.delete(`/scheduler/${id}`)
}

export function runScheduledTask(id) {
  return apiClient.post(`/scheduler/${id}/run`)
}

const schedulerApi = {
  getScheduledTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  runScheduledTask,
}

export default schedulerApi
