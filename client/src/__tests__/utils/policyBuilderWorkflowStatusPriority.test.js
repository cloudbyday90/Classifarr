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
      refreshing: true,
      activeEmptyStateActionId: 'sync_media_server_library',
      activeEmptyStateActionMessage: 'Classifarr is syncing this library.',
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_ERROR,
      role: 'alert',
      tone: 'warning',
      message: 'Classifarr could not load the library workflow.',
      busy: false,
    })
  })

  it('gives a workflow load priority over in-flight profile work', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      loading: true,
      refreshing: true,
      activeEmptyStateActionId: 'sync_media_server_library',
      activeEmptyStateActionMessage: 'Classifarr is syncing this library.',
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_LOADING,
      role: 'status',
      busy: true,
    })
  })

  it('keeps the active empty-state operation ahead of generic profile refresh feedback', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      refreshing: true,
      activeEmptyStateActionId: 'sync_media_server_library',
      activeEmptyStateActionMessage: 'Classifarr is syncing this library and refreshing its profile.',
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.EMPTY_STATE_ACTION,
      message: 'Classifarr is syncing this library and refreshing its profile.',
      busy: true,
    })
  })

  it('announces profile refresh progress without exposing a retry control', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      refreshing: true,
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.LIBRARY_PROFILE_REFRESH,
      message: 'Classifarr is refreshing library evidence.',
      busy: true,
    })
  })

  it('announces a completed refresh result when no higher-priority state exists', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      refreshResult: {
        status: 'error',
        tone: 'warning',
        label: 'Profile refresh deferred',
        message: 'Classifarr will retry automatically when the source is available.',
      },
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.PROFILE_REFRESH_RESULT,
      role: 'alert',
      tone: 'warning',
      message: 'Profile refresh deferred: Classifarr will retry automatically when the source is available.',
      busy: false,
    })
  })
})
