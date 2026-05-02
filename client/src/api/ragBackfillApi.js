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

export function getBackfillStatus() {
  return apiClient.get('/rag/backfill/status')
}

export function getBackfillConfig() {
  return apiClient.get('/rag/backfill/config')
}

export function updateBackfillConfig(data) {
  return apiClient.put('/rag/backfill/config', data)
}

export function startManualBackfill(data = {}) {
  return apiClient.post('/rag/backfill/manual/start', data)
}

export function pauseManualBackfill() {
  return apiClient.post('/rag/backfill/manual/pause')
}

export function resumeManualBackfill() {
  return apiClient.post('/rag/backfill/manual/resume')
}

export function clearManualBackfill() {
  return apiClient.post('/rag/backfill/manual/clear')
}

const ragBackfillApi = {
  getBackfillStatus,
  getBackfillConfig,
  updateBackfillConfig,
  startManualBackfill,
  pauseManualBackfill,
  resumeManualBackfill,
  clearManualBackfill,
}

export default ragBackfillApi
