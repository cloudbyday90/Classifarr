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

import { describe, expect, it } from 'vitest'
import {
  getOverviewTextModelLabel,
  getOverviewTextProviderLabel,
  normalizeImageEmbeddingMode,
} from '@/utils/ragConfigUi'

describe('ragConfigUi — provider and model label branches', () => {
  it('getOverviewTextProviderLabel returns cloud_provider when mode is cloud', () => {
    expect(getOverviewTextProviderLabel({ mode: 'cloud', cloud_provider: 'OpenAI' }))
      .toBe('OpenAI')
  })

  it('getOverviewTextProviderLabel falls back to "cloud" when cloud_provider is empty', () => {
    expect(getOverviewTextProviderLabel({ mode: 'cloud', cloud_provider: '' }))
      .toBe('cloud')
  })

  it('getOverviewTextProviderLabel returns "ollama" when mode is separate_ollama', () => {
    expect(getOverviewTextProviderLabel({ mode: 'separate_ollama' }))
      .toBe('ollama')
  })

  it('getOverviewTextModelLabel returns cloud_model when mode is cloud', () => {
    expect(getOverviewTextModelLabel({ mode: 'cloud', cloud_model: 'text-embedding-3' }))
      .toBe('text-embedding-3')
  })

  it('getOverviewTextModelLabel returns ollama_model when mode is separate_ollama', () => {
    expect(getOverviewTextModelLabel({ mode: 'separate_ollama', ollama_model: 'nomic' }))
      .toBe('nomic')
  })

  it('normalizeImageEmbeddingMode maps "local" to "separate_local" and rejects invalid modes', () => {
    expect(normalizeImageEmbeddingMode('local')).toBe('separate_local')
    expect(normalizeImageEmbeddingMode('bogus')).toBe('disabled')
  })

  it('getOverviewTextProviderLabel and model label fall through to defaults when mode is same', () => {
    expect(getOverviewTextProviderLabel({ mode: 'same', primary_provider: 'ollama' }))
      .toBe('ollama')
    expect(getOverviewTextModelLabel({ mode: 'same', embedding_model: 'nomic' }))
      .toBe('nomic')
  })

  it('getOverviewTextProviderLabel returns "classification" when primary_provider is missing', () => {
    expect(getOverviewTextProviderLabel({ mode: 'same' })).toBe('classification')
  })

  it('getOverviewTextModelLabel returns "default" when model fields are missing', () => {
    expect(getOverviewTextModelLabel({ mode: 'cloud' })).toBe('default')
    expect(getOverviewTextModelLabel({ mode: 'separate_ollama' })).toBe('default')
    expect(getOverviewTextModelLabel({ mode: 'same' })).toBe('default')
  })
})
