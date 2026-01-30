/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
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

import { describe, it, expect } from 'vitest'
import { getServiceIcon, SERVICE_ICONS } from '../utils/serviceIcons'

describe('serviceIcons.js', () => {
  it('exports SERVICE_ICONS constant', () => {
    expect(SERVICE_ICONS).toBeDefined()
    expect(typeof SERVICE_ICONS).toBe('object')
  })

  it('returns correct icon for direct match', () => {
    expect(getServiceIcon('Database')).toBe('🗄️')
    expect(getServiceIcon('Plex')).toBe('📺')
    expect(getServiceIcon('Radarr')).toBe('🎬')
    expect(getServiceIcon('Queue Worker')).toBe('⚡')
    expect(getServiceIcon('pgvector')).toBe('🧬')
  })

  it('returns correct icon for case-insensitive match', () => {
    expect(getServiceIcon('database')).toBe('🗄️')
    expect(getServiceIcon('PLEX')).toBe('📺')
  })

  it('returns default icon for unknown service', () => {
    expect(getServiceIcon('UnknownService')).toBe('📦')
    expect(getServiceIcon('')).toBe('📦')
  })

  it('handles null/undefined gracefully', () => {
    expect(getServiceIcon(null)).toBe('📦')
    expect(getServiceIcon(undefined)).toBe('📦')
  })
})
