/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { mockProposalPage, lifecycle, unavailableLifecycle, proposalVersion, fulfillJson } from './support/policyProposalFixtures.js'

test('a stale admission refreshes guidance without a blind retry', async ({ page }) => {
  let admissions = 0
  await mockProposalPage(page, {
    getLifecycle: () => admissions ? unavailableLifecycle : lifecycle,
    onAdmission: route => {
      admissions++
      return fulfillJson(route, { version: proposalVersion, statusId: 'proposal_stale', policy: null,
        recovery: { lifecycleReloadRequired: true } }, 409)
    },
  })
  await page.goto('/policies?library=7')
  await page.getByRole('button', { name: 'Create policy', exact: true }).click()
  const section = page.getByRole('region', { name: 'Movies', exact: true })
  await expect(section.getByText('No safe proposal yet', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Create policy', exact: true })).toHaveCount(0)
  expect(admissions).toBe(1)
})
