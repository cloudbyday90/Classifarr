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

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getRagTextModels,
  testRagConnection,
} from '../../api/ragTextEmbeddingApi'

describe('ragTextEmbeddingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRagTextModels calls POST with default empty object', async () => {
    mockPost.mockResolvedValueOnce({ data: [] })
    await getRagTextModels()
    expect(mockPost).toHaveBeenCalledWith('/rag/text-models', {})
  })

  it('getRagTextModels passes data', async () => {
    mockPost.mockResolvedValueOnce({ data: [] })
    await getRagTextModels({ provider: 'ollama' })
    expect(mockPost).toHaveBeenCalledWith('/rag/text-models', { provider: 'ollama' })
  })

  it('testRagConnection calls POST with data', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testRagConnection({ host: 'localhost', port: 11434 })
    expect(mockPost).toHaveBeenCalledWith('/rag/test-connection', { host: 'localhost', port: 11434 })
  })
})
