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
      saving: true,
      loading: true,
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
      automaticRecoveryMessage: 'Classifarr is waiting for automatic recovery.',
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_ERROR,
      role: 'alert',
      tone: 'warning',
      message: 'Classifarr could not load the library workflow.',
      busy: false,
    })
  })

  it('gives a policy save priority over loading and every non-error waiting state', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      saving: true,
      loading: true,
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
      automaticRecoveryMessage: 'Classifarr is waiting for automatic recovery.',
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.POLICY_SAVE,
      role: 'status',
      busy: true,
    })
  })

  it('gives a workflow load priority over an in-flight bounded action', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      loading: true,
      activeEmptyStateActionId: 'map_routing_destination',
      activeEmptyStateActionMessage: 'Classifarr is opening the library mapping page.',
      automaticRecoveryMessage: 'Classifarr is waiting for automatic recovery.',
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

  it('reports a failed bounded action as one safe action-local result', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      loading: true,
      emptyStateActionFeedback: {
        statusId: 'retryable_error',
        message: 'Classifarr could not open the library mapping. Try again.',
      },
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.EMPTY_STATE_ACTION_RESULT,
      role: 'alert',
      tone: 'warning',
      message: 'Classifarr could not open the library mapping. Try again.',
      busy: false,
    })
  })

  it('announces server-owned automatic recovery only when no active work takes priority', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      automaticRecoveryMessage: 'Classifarr is waiting for automatic profile recovery.',
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.AUTOMATIC_RECOVERY,
      role: 'status',
      tone: 'info',
      message: 'Classifarr is waiting for automatic profile recovery.',
      busy: false,
    })
  })
})
