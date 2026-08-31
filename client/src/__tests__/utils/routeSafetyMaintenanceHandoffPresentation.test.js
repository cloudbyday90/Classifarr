/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildRouteSafetyMaintenanceHandoffPresentation } from '@/utils/routeSafetyMaintenanceHandoffPresentation'

describe('routeSafetyMaintenanceHandoffPresentation', () => {
  it('renders only fixed copy for an allow-listed advisory handoff', () => {
    const presentation = buildRouteSafetyMaintenanceHandoffPresentation({
      version: 'classification.route_safety_maintenance_handoff.v1',
      status: { id: 'review_recommended', message: 'Untrusted message' },
      handoff: {
        gateId: 'policy_confirmation_required',
        currentCount: 4,
        previousCount: 5,
        policyId: 'private-policy',
        url: 'https://untrusted.example/',
      },
    })

    expect(presentation).toMatchObject({
      isRecommended: true,
      heading: 'Repeated policy confirmations',
      actionLabel: 'Review policy configuration',
    })
    expect(JSON.stringify(presentation)).not.toContain('Untrusted message')
    expect(JSON.stringify(presentation)).not.toContain('private-policy')
    expect(JSON.stringify(presentation)).not.toContain('untrusted.example')
  })

  it('fails closed for unknown gates and invalid status relationships', () => {
    expect(buildRouteSafetyMaintenanceHandoffPresentation({
      version: 'classification.route_safety_maintenance_handoff.v1',
      status: { id: 'review_recommended' },
      handoff: { gateId: 'unknown', currentCount: 5, previousCount: 5 },
    }).isRecommended).toBe(false)

    expect(buildRouteSafetyMaintenanceHandoffPresentation({
      version: 'classification.route_safety_maintenance_handoff.v1',
      status: { id: 'not_recommended' },
      handoff: { gateId: 'policy_confirmation_required', currentCount: 5, previousCount: 5 },
    }).isRecommended).toBe(false)
  })
})
