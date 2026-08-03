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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getPolicy,
  getPolicies,
  getPolicyOperatorWorkflow,
  getPolicyAuthoringLifecycle,
  preparePolicyAuthoringProposal,
  admitPolicyAuthoringProposal,
  getPolicyNativeReadinessSummary,
  validatePolicyOperatorWorkflowCustomIntentSignal,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getNativeIntentReconciliationStatus,
} from '../../api/policiesApi'

describe('policiesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPolicy calls getDataRequest with id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ id: 1, name: 'Test' })
    await getPolicy(1)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/1')
  })

  it('getPolicies calls getDataRequest with /policies', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicies()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies')
  })

  it('getPolicyOperatorWorkflow calls the read-only library workflow endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ statusId: 'ready' })

    await getPolicyOperatorWorkflow(7)

    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/operator-workflow/libraries/7')
  })

  it('getPolicyAuthoringLifecycle calls the server-owned lifecycle endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ statusId: 'eligible_to_prepare_proposal' })

    await getPolicyAuthoringLifecycle(7)

    expect(mockGetDataRequest).toHaveBeenCalledWith(
      '/policies/operator-workflow/libraries/7/authoring-lifecycle'
    )
  })

  it('prepares an empty server-owned proposal request for the selected library', async () => {
    mockPost.mockResolvedValueOnce({ data: { statusId: 'proposal_prepared' } })

    await preparePolicyAuthoringProposal(7)

    expect(mockPost).toHaveBeenCalledWith(
      '/policies/operator-workflow/libraries/7/proposals',
      {}
    )
  })

  it('admits the opaque reference, revision, typed adjustments, and stable idempotency key', async () => {
    mockPost.mockResolvedValueOnce({ data: { statusId: 'proposal_admission_created' } })

    await admitPolicyAuthoringProposal(
      7,
      'proposal_reference_123456789012345678',
      'a'.repeat(64),
      {
        idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
        adjustmentCommands: [{ commandId: 'set_purpose_genres', values: ['Animation'] }],
      }
    )

    expect(mockPost).toHaveBeenCalledWith(
      '/policies/operator-workflow/libraries/7/proposals/proposal_reference_123456789012345678/admission',
      {
        proposal_revision: 'a'.repeat(64),
        adjustment_commands: [{ command_id: 'set_purpose_genres', values: ['Animation'] }],
      },
      {
        headers: {
          'Idempotency-Key': '"6fe3d170-9390-4ec5-95f7-42ad6f8ec777"',
        },
      }
    )
  })

  it('does not post adjustment commands outside the narrow proposal contract', async () => {
    expect(() => admitPolicyAuthoringProposal(
      7,
      'proposal_reference_123456789012345678',
      'a'.repeat(64),
      { adjustmentCommands: [{ commandId: 'set_hard_limit', values: ['PG-13'] }] }
    )).toThrow('adjustment commands are invalid')

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('getPolicyNativeReadinessSummary calls the read-only stored-native readiness endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ statusId: 'native_policy_readiness_available' })

    await getPolicyNativeReadinessSummary(7)

    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/7/native-intent/readiness-summary')
  })

  it('validatePolicyOperatorWorkflowCustomIntentSignal posts only the explicit custom-entry payload', async () => {
    const payload = {
      signalType: 'studios',
      value: 'Studio Ghibli',
      explanation: 'This library is intended for films from this studio.',
    }
    mockPost.mockResolvedValueOnce({ data: { version: 'policy.operator_workflow_read.v4' } })

    await validatePolicyOperatorWorkflowCustomIntentSignal(7, payload)

    expect(mockPost).toHaveBeenCalledWith(
      '/policies/operator-workflow/libraries/7/intent-signals/custom',
      payload
    )
  })

  it('createPolicy calls POST with data', async () => {
    const data = { name: 'New Policy', library_id: 1 }
    mockPost.mockResolvedValueOnce({ data: { id: 2 } })
    await createPolicy(data)
    expect(mockPost).toHaveBeenCalledWith('/policies', data)
  })

  it('createPolicy forwards a caller-stable idempotency key for native creation', async () => {
    const data = {
      library_id: 1,
      name: 'Native Policy',
      native_intent_establishment: { declared_intent: { purpose: [] } },
    }
    mockPost.mockResolvedValueOnce({ data: { id: 2 } })

    await createPolicy(data, {
      idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    expect(mockPost).toHaveBeenCalledWith('/policies', data, {
      headers: {
        'Idempotency-Key': '"6fe3d170-9390-4ec5-95f7-42ad6f8ec777"',
      },
    })
  })

  it('updatePolicy calls PUT with id and data', async () => {
    const data = { name: 'Updated' }
    mockPut.mockResolvedValueOnce({ data: {} })
    await updatePolicy(5, data)
    expect(mockPut).toHaveBeenCalledWith('/policies/5', data)
  })

  it('deletePolicy calls DELETE with id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deletePolicy(3)
    expect(mockDelete).toHaveBeenCalledWith('/policies/3')
  })

  it('getNativeIntentReconciliationStatus calls the read-only status endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ statusId: 'ready' })

    await getNativeIntentReconciliationStatus()

    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/native-intent-reconciliation/status')
  })
})
