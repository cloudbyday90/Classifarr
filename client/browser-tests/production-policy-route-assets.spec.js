/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import {
  createAssetBudgetReport,
  getAssetFileName,
  isLocalProductionScriptAsset,
  POLICY_ROUTE_SCRIPT_BUDGET_BYTES,
  PRODUCTION_POLICY_ROUTE_SCENARIOS,
} from './support/productionPolicyRouteBudget.mjs'

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function blockServiceAccess(page) {
  const nonReadRequests = []

  await page.route('**/api/**', route => {
    const request = route.request()
    const method = request.method()
    const pathname = new globalThis.URL(request.url()).pathname

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      nonReadRequests.push({ method, pathname })
      return fulfillJson(route, { error: 'production asset smoke blocks mutations' }, 405)
    }

    if (pathname === '/api/setup/status') {
      return fulfillJson(route, { setupRequired: false })
    }

    if (pathname === '/api/auth/me' || pathname === '/api/user/me') {
      return fulfillJson(route, { id: 1, username: 'production-asset-smoke' })
    }

    // Delivery smoke does not exercise the API contract. Fail unknown reads
    // without letting the browser contact a local or remote application.
    return fulfillJson(route, { error: 'production asset smoke fixture' }, 503)
  })

  return nonReadRequests
}

function captureProductionScriptAssets(page) {
  const scriptRequests = []
  const failedScriptRequests = []

  page.on('requestfinished', request => {
    if (request.resourceType() === 'script' && isLocalProductionScriptAsset(request.url())) {
      scriptRequests.push(request)
    }
  })

  page.on('requestfailed', request => {
    if (request.resourceType() === 'script' && isLocalProductionScriptAsset(request.url())) {
      failedScriptRequests.push({ url: request.url(), failure: request.failure()?.errorText })
    }
  })

  return {
    failedScriptRequests,
    async report() {
      const assets = await Promise.all(scriptRequests.map(async request => {
        const response = await request.response()

        return {
          fileName: getAssetFileName(request.url()),
          status: response?.status() ?? 0,
          byteLength: response ? (await response.body()).byteLength : 0,
        }
      }))

      return createAssetBudgetReport(assets)
    },
  }
}

for (const scenario of PRODUCTION_POLICY_ROUTE_SCENARIOS) {
  test(`cold production navigation loads only the ${scenario.name} page chunk within budget`, async ({ page }, testInfo) => {
    const nonReadRequests = await blockServiceAccess(page)
    const capture = captureProductionScriptAssets(page)
    const pageErrors = []

    page.on('pageerror', error => pageErrors.push(error.message))

    await page.goto(scenario.path, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible()

    const report = await capture.report()
    await testInfo.attach('production-policy-route-assets.json', {
      body: Buffer.from(JSON.stringify({ scenario, ...report }, null, 2)),
      contentType: 'application/json',
    })

    const loadedPageRouteChunkPrefixes = PRODUCTION_POLICY_ROUTE_SCENARIOS
      .filter(candidate => report.assets.some(asset => asset.fileName.startsWith(candidate.routeChunkPrefix)))
      .map(candidate => candidate.routeChunkPrefix)

    expect(nonReadRequests).toEqual([])
    expect(pageErrors).toEqual([])
    expect(capture.failedScriptRequests).toEqual([])
    expect(report.assets.every(asset => asset.status === 200)).toBe(true)
    expect(
      loadedPageRouteChunkPrefixes,
      `cold navigation for ${scenario.path} must not load another policy page chunk`,
    ).toEqual([scenario.routeChunkPrefix])
    expect(report.scriptBytes).toBeLessThanOrEqual(POLICY_ROUTE_SCRIPT_BUDGET_BYTES)
  })
}
