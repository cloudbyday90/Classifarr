/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { mockProposalPage, lifecycle, existingLifecycle, proposalVersion, fulfillJson } from './support/policyProposalFixtures.js'

test('two tabs reconcile one created policy and one conflict without resubmitting', async ({ context }) => {
  let admissions = 0
  const setup = page => mockProposalPage(page, {
    getLifecycle: () => admissions ? existingLifecycle : lifecycle,
    onAdmission: route => {
      admissions++
      return admissions === 1
        ? fulfillJson(route, { version: proposalVersion, statusId: 'proposal_admission_created',
          policy: { id: 99, libraryId: 7, name: 'Movies Policy' }, recovery: { lifecycleReloadRequired: false } })
        : fulfillJson(route, { version: proposalVersion, statusId: 'existing_policy', policy: null,
          recovery: { lifecycleReloadRequired: true } }, 409)
    },
  })
  const first = await context.newPage(), second = await context.newPage()
  await setup(first); await setup(second)
  await Promise.all([first.goto('/policies?library=7'), second.goto('/policies?library=7')])
  const button = page => page.getByRole('button', { name: 'Create policy', exact: true })
  await expect(button(first)).toBeVisible(); await expect(button(second)).toBeVisible()
  await Promise.all([button(first).click(), button(second).click()])
  for (const page of [first, second]) {
    await expect(page.getByRole('region', { name: 'Movies', exact: true }).getByText('Policy already exists', { exact: true })).toBeVisible()
    await expect(button(page)).toHaveCount(0)
  }
  expect(admissions).toBe(2)
})
