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
import { POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS } from '@/utils/policyNativeEvidenceRecovery'

function buildRecovery(overrides = {}) {
  return {
    statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_NEEDS_REFRESH,
    heading: 'Library evidence needs a refresh',
    message: 'Refresh the library profile before using observed values.',
    requiresAction: true,
    tone: 'warning',
    ...overrides,
  }
}

describe('policyBuilderWorkflowStatusPriority', () => {
  it('gives a workflow error priority over every waiting state', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      error: 'Classifarr could not load the library workflow.',
      loading: true,
      refreshing: true,
      activeEmptyStateActionId: 'sync_media_server_library',
      activeEmptyStateActionMessage: 'Classifarr is syncing this library.',
      nativeEvidenceRecovery: buildRecovery(),
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_ERROR,
      role: 'alert',
      tone: 'warning',
      message: 'Classifarr could not load the library workflow.',
      busy: false,
    })
  })

  it('gives a workflow load priority over in-flight recovery work', () => {
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
      nativeEvidenceRecovery: buildRecovery(),
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.EMPTY_STATE_ACTION,
      message: 'Classifarr is syncing this library and refreshing its profile.',
      busy: true,
    })
  })

  it('announces profile refresh progress before a static recovery card', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      refreshing: true,
      nativeEvidenceRecovery: buildRecovery(),
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.LIBRARY_PROFILE_REFRESH,
      message: 'Classifarr is refreshing library evidence.',
      busy: true,
    })
  })

  it('uses an assertive status only for a completed refresh failure', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      nativeEvidenceRecovery: buildRecovery({
        statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED,
        heading: 'Library profile refresh did not complete',
        message: 'Try again when the connected library is available.',
      }),
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.NATIVE_EVIDENCE_RECOVERY,
      role: 'alert',
      message: 'Library profile refresh did not complete Try again when the connected library is available.',
      busy: false,
    })
  })

  it('keeps advisory recovery ahead of a completed refresh summary', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      nativeEvidenceRecovery: buildRecovery(),
      refreshResult: {
        status: 'success_empty',
        tone: 'warning',
        label: 'Profile refreshed',
        message: 'No usable signals were found.',
      },
    })).toMatchObject({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.NATIVE_EVIDENCE_RECOVERY,
      role: 'status',
      message: 'Library evidence needs a refresh Refresh the library profile before using observed values.',
    })
  })

  it('announces a completed refresh result only when no higher-priority state exists', () => {
    expect(buildPolicyBuilderWorkflowStatus({
      refreshResult: {
        status: 'success',
        tone: 'success',
        label: 'Profile refreshed',
        message: '2 genres are available from the current library profile.',
      },
    })).toEqual({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.PROFILE_REFRESH_RESULT,
      role: 'status',
      tone: 'success',
      message: 'Profile refreshed: 2 genres are available from the current library profile.',
      busy: false,
    })
  })
})
