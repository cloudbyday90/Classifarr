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
  buildEmbeddingProviderIndicator,
  getEmbeddingAvailabilityToneClasses,
  normalizeEmbeddingAvailability,
} from '@/utils/embeddingAvailabilityUi'

describe('embeddingAvailabilityUi — tone classes and indicator branches', () => {
  it('getEmbeddingAvailabilityToneClasses returns warning classes for probing status', () => {
    const classes = getEmbeddingAvailabilityToneClasses({ status: 'probing' })

    expect(classes.textClass).toBe('text-yellow-400')
    expect(classes.bannerClass).toContain('yellow')
  })

  it('getEmbeddingAvailabilityToneClasses returns danger classes for cooldown status', () => {
    const classes = getEmbeddingAvailabilityToneClasses({ status: 'cooldown' })

    expect(classes.textClass).toBe('text-red-400')
    expect(classes.bannerClass).toContain('red')
  })

  it('getEmbeddingAvailabilityToneClasses returns success classes for available status', () => {
    const classes = getEmbeddingAvailabilityToneClasses({ status: 'available' })

    expect(classes.textClass).toBe('text-green-400')
    expect(classes.bannerClass).toContain('green')
  })

  it('buildEmbeddingProviderIndicator returns not-configured when providerConfigured is false', () => {
    const result = buildEmbeddingProviderIndicator(
      { status: 'available' },
      { providerConfigured: false }
    )

    expect(result.label).toBe('Not Configured')
    expect(result.flag).toBe('CFG')
  })

  it('buildEmbeddingProviderIndicator returns offline when available but not online', () => {
    const result = buildEmbeddingProviderIndicator(
      { status: 'available' },
      { providerOnline: false, providerConfigured: true }
    )

    expect(result.label).toBe('Offline')
    expect(result.flag).toBe('OFF')
  })

  it('normalizeEmbeddingAvailability produces Probe Due label for probe_due status', () => {
    const result = normalizeEmbeddingAvailability({ status: 'probe_due' })

    expect(result.presentation.statusLabel).toBe('Probe Due')
    expect(result.presentation.flag).toBe('HOLD')
    expect(result.presentation.tone).toBe('warning')
  })

  it('getEmbeddingAvailabilityToneClasses returns gray classes for unknown tone', () => {
    const classes = getEmbeddingAvailabilityToneClasses({
      status: 'available',
      presentation: { tone: 'info' },
    })

    expect(classes.textClass).toBe('text-gray-400')
    expect(classes.bannerClass).toContain('gray')
  })
})
