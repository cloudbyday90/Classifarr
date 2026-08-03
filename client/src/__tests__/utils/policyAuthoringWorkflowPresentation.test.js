/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  adaptPolicyAuthoringWorkflowPresentation,
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS,
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
} from '@/utils/policyAuthoringWorkflowPresentation'

function buildWorkflowRead(overrides = {}) {
  return {
    version: 'policy.operator_workflow_read.v4',
    statusId: 'ready',
    library: {
      id: 9,
      name: 'Family Movies',
      mediaType: 'movie',
    },
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    rawPayloadExposed: false,
    presentation: {
      version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
      revision: 'a'.repeat(43),
      library: {
        id: 9,
        name: 'Family Movies',
        mediaType: 'movie',
      },
      destinationProposal: {
        statusId: 'ready',
        title: 'Define this destination',
        summary: 'Review the observed library context before changing policy intent.',
        available: true,
        requiresExplicitAdmission: true,
        observedContext: {
          available: true,
          current: true,
          itemCount: 52,
          suggestionCount: 3,
        },
      },
      nextAction: {
        kind: 'owner_action',
        ownerId: 'intent_signal_picker',
        sectionId: 'what_belongs_here',
        actionId: 'add_destination_examples',
        message: 'Accept a current library suggestion or add a declared destination value.',
      },
      adjustment: {
        available: true,
        statusId: 'available',
      },
      recovery: {
        statusId: 'ready',
        automated: false,
        message: null,
      },
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
      },
      rawPayloadExposed: false,
    },
    workflow: { hiddenFromPresentation: true },
    providerPayload: { shouldNotReachTheViewModel: true },
    ...overrides,
  }
}

describe('policyAuthoringWorkflowPresentation', () => {
  it('projects only immutable display-safe values from the server contract', () => {
    const result = adaptPolicyAuthoringWorkflowPresentation({
      workflowRead: buildWorkflowRead(),
      expectedLibraryId: 9,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation).toEqual(expect.objectContaining({
      version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
      statusId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS.READY,
      library: { id: 9, name: 'Family Movies', mediaType: 'movie' },
      destinationProposal: expect.objectContaining({ available: true }),
    }))
    expect(result.presentation).not.toHaveProperty('workflow')
    expect(result.presentation).not.toHaveProperty('providerPayload')
    expect(Object.isFrozen(result.presentation)).toBe(true)
    expect(Object.isFrozen(result.presentation.destinationProposal)).toBe(true)
  })

  it.each([
    ['mismatched enclosing status', workflowRead => {
      workflowRead.statusId = 'profile_needs_refresh'
    }],
    ['mismatched library', workflowRead => {
      workflowRead.presentation.library.id = 10
    }],
    ['mismatched enclosing authority', workflowRead => {
      workflowRead.authority = {
        displayProjection: true,
        automationDecision: true,
        policyPersistence: false,
        routingExecution: false,
      }
    }],
    ['raw data exposure', workflowRead => {
      workflowRead.presentation.rawPayloadExposed = true
    }],
    ['unsafe authority', workflowRead => {
      workflowRead.presentation.authority.policyPersistence = true
    }],
    ['unsupported action', workflowRead => {
      workflowRead.presentation.nextAction.kind = 'browser_inference'
    }],
    ['inconsistent recovery', workflowRead => {
      workflowRead.presentation.recovery.automated = true
      workflowRead.presentation.recovery.message = 'The browser will recover this.'
    }],
  ])('fails closed for %s', (_label, mutate) => {
    const workflowRead = buildWorkflowRead()
    mutate(workflowRead)

    const result = adaptPolicyAuthoringWorkflowPresentation({
      workflowRead,
      expectedLibraryId: 9,
    })

    expect(result.ok).toBe(false)
    expect(result.presentation).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS.UNAVAILABLE,
      library: expect.objectContaining({ id: 9 }),
      destinationProposal: null,
      nextAction: null,
    }))
    expect(Object.isFrozen(result.presentation)).toBe(true)
  })
})
