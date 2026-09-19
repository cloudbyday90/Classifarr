/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { mockProposalPage, lifecycle, existingLifecycle } from './support/policyProposalFixtures.js'

test('a lost response reloads lifecycle and finds the created policy without resubmitting', async ({ page }) => {
  let admissions = 0, lifecycleReads = 0
  await mockProposalPage(page, {
    getLifecycle: () => { lifecycleReads++; return admissions ? existingLifecycle : lifecycle },
    onAdmission: route => { admissions++; return route.abort('failed') },
  })
  await page.goto('/policies?library=7')
  await page.getByRole('button', { name: 'Create policy', exact: true }).click()
  const section = page.getByRole('region', { name: 'Movies', exact: true })
  await expect(section.getByText('Policy already exists', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Create policy', exact: true })).toHaveCount(0)
  expect(lifecycleReads).toBeGreaterThanOrEqual(2)
  expect(admissions).toBe(1)
})
