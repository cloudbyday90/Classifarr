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
  getBackfillToneClasses,
  normalizeBackfillModeStatus,
} from '@/utils/backfillStatusUi'

describe('backfillStatusUi — uncovered presentation and tone branches', () => {
  it('builds "cooldown" presentation with warning tone', () => {
    const result = normalizeBackfillModeStatus('manual', { status: 'cooldown' })

    expect(result.presentation.statusLabel).toBe('Waiting')
    expect(result.presentation.tone).toBe('warning')
  })

  it('builds "completed" and "failed" presentations with correct tones', () => {
    const completed = normalizeBackfillModeStatus('manual', { status: 'completed' })
    expect(completed.presentation.statusLabel).toBe('Completed')
    expect(completed.presentation.tone).toBe('success')

    const failed = normalizeBackfillModeStatus('manual', { status: 'failed' })
    expect(failed.presentation.statusLabel).toBe('Failed')
    expect(failed.presentation.tone).toBe('danger')
  })

  it('builds "enabled" presentation with success tone', () => {
    const result = normalizeBackfillModeStatus('manual', { status: 'enabled' })

    expect(result.presentation.statusLabel).toBe('Enabled')
    expect(result.presentation.tone).toBe('success')
  })

  it('getBackfillToneClasses returns warning classes for paused status', () => {
    const status = normalizeBackfillModeStatus('manual', { status: 'paused' })
    const classes = getBackfillToneClasses(status)

    expect(classes.textClass).toBe('text-yellow-400')
    expect(classes.bannerClass).toContain('yellow')
  })

  it('getBackfillToneClasses returns danger classes for failed status', () => {
    const status = normalizeBackfillModeStatus('manual', { status: 'failed' })
    const classes = getBackfillToneClasses(status)

    expect(classes.textClass).toBe('text-red-400')
    expect(classes.bannerClass).toContain('red')
  })

  it('getBackfillToneClasses returns info/blue classes for running status', () => {
    const status = normalizeBackfillModeStatus('manual', { status: 'running' })
    const classes = getBackfillToneClasses(status)

    expect(classes.textClass).toBe('text-blue-400')
    expect(classes.bannerClass).toContain('blue')
  })

  it('getBackfillToneClasses returns success/green classes for completed status', () => {
    const status = normalizeBackfillModeStatus('manual', { status: 'completed' })
    const classes = getBackfillToneClasses(status)

    expect(classes.textClass).toBe('text-green-400')
    expect(classes.bannerClass).toContain('green')
  })
})
