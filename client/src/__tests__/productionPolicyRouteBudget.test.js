/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import productionConfig from '../../playwright.production.config.js'
import {
  createAssetBudgetReport,
  getAssetFileName,
  getPolicyRouteChunkGroup,
  isLocalProductionScriptAsset,
  POLICY_ROUTE_SCRIPT_BUDGET_BYTES,
  PRODUCTION_POLICY_ROUTE_BASE_URL,
  PRODUCTION_POLICY_ROUTE_SCENARIOS,
} from '../../browser-tests/support/productionPolicyRouteBudget.mjs'

describe('production policy-route asset budget', () => {
  it('keeps every route scenario unique and bounded', () => {
    expect(POLICY_ROUTE_SCRIPT_BUDGET_BYTES).toBe(512 * 1024)
    expect(new Set(PRODUCTION_POLICY_ROUTE_SCENARIOS.map(scenario => scenario.path)).size)
      .toBe(PRODUCTION_POLICY_ROUTE_SCENARIOS.length)
    expect(new Set(PRODUCTION_POLICY_ROUTE_SCENARIOS.map(scenario => scenario.routeChunkPrefix)).size)
      .toBe(PRODUCTION_POLICY_ROUTE_SCENARIOS.length)
    expect(PRODUCTION_POLICY_ROUTE_SCENARIOS.map(scenario => (
      getPolicyRouteChunkGroup(scenario.routeChunkPrefix)
    ))).toEqual(PRODUCTION_POLICY_ROUTE_SCENARIOS.map(scenario => scenario.chunkGroup))
  })

  it('accepts only local immutable JavaScript assets', () => {
    expect(isLocalProductionScriptAsset(`${PRODUCTION_POLICY_ROUTE_BASE_URL}/assets/policy-insights~Evidence-abc.js`)).toBe(true)
    expect(isLocalProductionScriptAsset(`${PRODUCTION_POLICY_ROUTE_BASE_URL}/assets/index.css`)).toBe(false)
    expect(isLocalProductionScriptAsset('https://example.com/assets/policy-insights~Evidence-abc.js')).toBe(false)
  })

  it('identifies only the configured policy chunk groups', () => {
    expect(getAssetFileName(`${PRODUCTION_POLICY_ROUTE_BASE_URL}/assets/policy-authoring~PolicyList-abc.js`)).toBe('policy-authoring~PolicyList-abc.js')
    expect(getPolicyRouteChunkGroup('policy-maintenance~PolicyHistoricRouteSafetyRefresh-abc.js')).toBe('policy-maintenance')
    expect(getPolicyRouteChunkGroup('vue-vendor-abc.js')).toBeUndefined()
  })

  it('reports a stable aggregate without raw response content', () => {
    expect(createAssetBudgetReport([
      { fileName: 'one.js', status: 200, byteLength: 10 },
      { fileName: 'two.js', status: 200, byteLength: 15 },
    ])).toEqual({
      scriptAssetCount: 2,
      scriptBytes: 25,
      assets: [
        { fileName: 'one.js', status: 200, byteLength: 10 },
        { fileName: 'two.js', status: 200, byteLength: 15 },
      ],
    })
  })

  it('uses a strict loopback production-preview server', () => {
    expect(productionConfig.use.baseURL).toBe(PRODUCTION_POLICY_ROUTE_BASE_URL)
    expect(productionConfig.webServer).toMatchObject({
      url: PRODUCTION_POLICY_ROUTE_BASE_URL,
      reuseExistingServer: false,
    })
    expect(productionConfig.webServer.command).toContain('--host 127.0.0.1')
    expect(productionConfig.webServer.command).toContain('--strictPort')
  })
})
