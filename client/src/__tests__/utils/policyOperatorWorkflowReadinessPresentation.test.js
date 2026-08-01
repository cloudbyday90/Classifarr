/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  isApprovedPolicyOperatorWorkflowReadinessPresentation,
} from '@/utils/policyOperatorWorkflowReadinessPresentation'

function buildPresentation(overrides = {}) {
  return {
    version: 'policy.operator_workflow_readiness_presentation.v1',
    primary: {
      stateId: 'stale_profile',
      kind: 'automated_guidance',
      ownerId: 'observed_profile_summary',
      actionId: null,
      message: 'Classifarr waits for automatic profile recovery before it uses these observations for automation. No action is needed here.',
    },
    issues: [{
      stateId: 'stale_profile',
      kind: 'automated_guidance',
      ownerId: 'observed_profile_summary',
      actionId: null,
      message: 'Classifarr waits for automatic profile recovery before it uses these observations for automation. No action is needed here.',
    }],
    rawPayloadExposed: false,
    ...overrides,
  }
}

describe('policyOperatorWorkflowReadinessPresentation', () => {
  it('accepts a server-owned primary resolution that matches workflow readiness', () => {
    expect(isApprovedPolicyOperatorWorkflowReadinessPresentation({
      presentation: buildPresentation(),
      readiness: { stateId: 'stale_profile' },
    })).toBe(true)
  })

  it('rejects guidance that implies a browser action, raw payload exposure, or mismatched readiness', () => {
    const actionShapedGuidance = buildPresentation()
    actionShapedGuidance.primary.actionId = 'refresh_profile'
    actionShapedGuidance.issues[0].actionId = 'refresh_profile'

    expect(isApprovedPolicyOperatorWorkflowReadinessPresentation({
      presentation: actionShapedGuidance,
      readiness: { stateId: 'stale_profile' },
    })).toBe(false)
    expect(isApprovedPolicyOperatorWorkflowReadinessPresentation({
      presentation: buildPresentation(),
      readiness: { stateId: 'needs_more_examples' },
    })).toBe(false)
    expect(isApprovedPolicyOperatorWorkflowReadinessPresentation({
      presentation: buildPresentation({ rawPayloadExposed: true }),
      readiness: { stateId: 'stale_profile' },
    })).toBe(false)
  })
})
