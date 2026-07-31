/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_BUILDER_WORKFLOW_STATUS_IDS,
  buildPolicyBuilderWorkflowStatus,
} from '@/utils/policyBuilderWorkflowStatusPriority'

describe('policyBuilderWorkflowStatusPriority', () => {
  it('gives a workflow error priority over every waiting state', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      error: 'Classifarr could not load the library workflow.',
      loading: true,
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_ERROR,
      role: 'alert',
      tone: 'warning',
      message: 'Classifarr could not load the library workflow.',
      busy: false,
    })
  })

  it('gives a workflow load priority over an in-flight bounded action', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      loading: true,
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_LOADING,
      role: 'status',
      busy: true,
    })
  })

  it('announces the active bounded empty-state operation', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.EMPTY_STATE_ACTION,
      message: 'Classifarr is opening the library mapping page.',
      busy: true,
    })
  })
})
