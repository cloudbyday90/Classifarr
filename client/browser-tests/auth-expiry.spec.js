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

import { expect, test } from '@playwright/test'

const HEALTHY_SYSTEM_RESPONSE = {
  database: 'healthy',
  mediaServer: 'healthy',
  radarr: 'healthy',
  sonarr: 'healthy',
  ollama: 'healthy',
  imageEmbeddings: 'healthy',
  tmdb: 'healthy',
  omdb: 'healthy',
  discordBot: 'healthy',
  tavily: 'healthy',
  queueWorker: 'healthy',
  details: {},
}

test('redirects an expired session to the login page in a real browser', async ({ page }) => {
  await page.route('**/api/setup/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setupRequired: false }),
    })
  })

  await page.route('**/api/system/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(HEALTHY_SYSTEM_RESPONSE),
    })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Access token expired' }),
    })
  })

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Refresh token expired' }),
    })
  })

  await page.goto('/settings')

  await page.waitForURL('**/login?expired=true')
  await expect(page.getByText('Sign in to continue')).toBeVisible()
  await expect(page.getByText('Session expired. Please log in again.')).toBeVisible()
})
