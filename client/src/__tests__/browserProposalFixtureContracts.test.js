/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from 'vitest'
import { library, lifecycle, existingLifecycle, unavailableLifecycle, mockProposalPage } from '../../browser-tests/support/policyProposalFixtures.js'
import { adaptPolicyAuthoringLifecyclePresentation } from '../utils/policyAuthoringLifecyclePresentation.js'
import { adaptPolicyAuthoringPreparedProposalPresentation } from '../utils/policyAuthoringProposalPresentation.js'

test.each([lifecycle, existingLifecycle, unavailableLifecycle])('browser lifecycle fixture obeys the strict $statusId contract', fixture => {
  expect(adaptPolicyAuthoringLifecyclePresentation({ lifecycle: fixture, expectedLibrary: library }).ok).toBe(true)
})

test('browser prepared proposal includes the required adjustment and bounded opaque reference', async () => {
  let handler, response
  await mockProposalPage({ route: async (matches, callback) => {
    expect(matches(new URL('http://127.0.0.1/api/libraries'))).toBe(true)
    expect(matches(new URL('http://127.0.0.1/src/api/policiesApi.js'))).toBe(false)
    handler = callback
  } }, { getLifecycle: () => lifecycle })
  await handler({ request: () => ({ url: () => 'http://127.0.0.1/api/policies/operator-workflow/libraries/7/proposals' }),
    fulfill: async data => { response = JSON.parse(data.body) } })
  expect(adaptPolicyAuthoringPreparedProposalPresentation({ response, expectedLibrary: library }).ok).toBe(true)
})
