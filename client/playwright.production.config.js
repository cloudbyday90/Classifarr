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

import { defineConfig, devices } from '@playwright/test'
import {
  PRODUCTION_POLICY_ROUTE_BASE_URL,
  PRODUCTION_POLICY_ROUTE_PORT,
} from './browser-tests/support/productionPolicyRouteBudget.mjs'

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/production-policy-route-assets.spec.js',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: globalThis.process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: PRODUCTION_POLICY_ROUTE_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-production-policy-assets',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${PRODUCTION_POLICY_ROUTE_PORT} --strictPort`,
    url: PRODUCTION_POLICY_ROUTE_BASE_URL,
    // Refuse a pre-existing server so this suite always exercises dist/.
    reuseExistingServer: false,
    timeout: 120000,
  },
})
