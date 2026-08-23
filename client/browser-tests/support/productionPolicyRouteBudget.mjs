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

export const PRODUCTION_POLICY_ROUTE_PORT = 4174
export const PRODUCTION_POLICY_ROUTE_BASE_URL = `http://127.0.0.1:${PRODUCTION_POLICY_ROUTE_PORT}`
export const POLICY_ROUTE_SCRIPT_BUDGET_BYTES = 512 * 1024

export const POLICY_ROUTE_CHUNK_GROUPS = [
  'policy-authoring',
  'policy-maintenance',
  'policy-insights',
]

export const PRODUCTION_POLICY_ROUTE_SCENARIOS = [
  {
    name: 'policy authoring',
    path: '/policies',
    heading: 'Library Policy Setup',
    chunkGroup: 'policy-authoring',
    routeChunkPrefix: 'policy-authoring~PolicyList-',
  },
  {
    name: 'preset authoring',
    path: '/presets',
    heading: 'Presets Manager',
    chunkGroup: 'policy-authoring',
    routeChunkPrefix: 'policy-authoring~PresetsManager-',
  },
  {
    name: 'native intent maintenance',
    path: '/policies/native-intent-reconciliation',
    heading: 'Native intent reconciliation',
    chunkGroup: 'policy-maintenance',
    routeChunkPrefix: 'policy-maintenance~PolicyNativeIntentReconciliation-',
  },
  {
    name: 'historic route maintenance',
    path: '/policies/historic-route-safety-refresh',
    heading: 'Historic route-safety refresh',
    chunkGroup: 'policy-maintenance',
    routeChunkPrefix: 'policy-maintenance~PolicyHistoricRouteSafetyRefresh-',
  },
  {
    name: 'tuning insights',
    path: '/tuning-suggestions',
    heading: 'Tuning Suggestions',
    chunkGroup: 'policy-insights',
    routeChunkPrefix: 'policy-insights~TuningSuggestionsDashboard-',
  },
  {
    name: 'evidence insights',
    path: '/evidence',
    heading: 'Classification Evidence',
    chunkGroup: 'policy-insights',
    routeChunkPrefix: 'policy-insights~Evidence-',
  },
  {
    name: 'policy statistics insights',
    path: '/policy-stats',
    heading: 'Policy Statistics',
    chunkGroup: 'policy-insights',
    routeChunkPrefix: 'policy-insights~PolicyStatsDashboard-',
  },
]

export function getAssetFileName(assetUrl) {
  return new globalThis.URL(assetUrl).pathname.split('/').at(-1)
}

export function isLocalProductionScriptAsset(assetUrl) {
  const url = new globalThis.URL(assetUrl)

  return url.origin === PRODUCTION_POLICY_ROUTE_BASE_URL
    && url.pathname.startsWith('/assets/')
    && url.pathname.endsWith('.js')
}

export function getPolicyRouteChunkGroup(assetFileName) {
  return POLICY_ROUTE_CHUNK_GROUPS.find(group => assetFileName.startsWith(`${group}~`))
}

export function createAssetBudgetReport(scriptAssets) {
  return {
    scriptAssetCount: scriptAssets.length,
    scriptBytes: scriptAssets.reduce((total, asset) => total + asset.byteLength, 0),
    assets: scriptAssets,
  }
}
