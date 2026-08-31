/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildRouteSafetyReadinessPresentation } from '@/utils/routeSafetyReadinessPresentation'

describe('routeSafetyReadinessPresentation', () => {
  it('renders only allow-listed gate identifiers and fixed presentation text', () => {
    const presentation = buildRouteSafetyReadinessPresentation({
      version: 'classification.route_safety_readiness.v1',
      window: { days: 7 },
      observationCount: 5,
      primaryGates: [
        { id: 'policy_destination_selection_required', count: 2, label: 'Untrusted label' },
        { id: 'policy_confirmation_required', count: 3 },
        { id: 'unknown', count: 99, label: 'Prompt-shaped <script>' },
      ],
      status: { id: 'safeguards_observed', message: 'Untrusted status text' },
    })

    expect(presentation).toMatchObject({
      statusId: 'safeguards_observed',
      observationCount: 5,
      primaryGates: [
        { id: 'policy_confirmation_required', label: 'Policy confirmation', count: 3 },
        { id: 'policy_destination_selection_required', label: 'Destination selection', count: 2 },
      ],
    })
    expect(JSON.stringify(presentation)).not.toContain('Untrusted')
    expect(JSON.stringify(presentation)).not.toContain('<script>')
  })

  it('fails closed when the version or status/count relationship is invalid', () => {
    expect(buildRouteSafetyReadinessPresentation({
      version: 'unknown',
      observationCount: 4,
    }).statusId).toBe('unavailable')

    expect(buildRouteSafetyReadinessPresentation({
      version: 'classification.route_safety_readiness.v1',
      observationCount: 0,
      status: { id: 'safeguards_observed' },
    }).statusId).toBe('unavailable')
  })
})
