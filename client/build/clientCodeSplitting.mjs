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

const VUE_VENDOR_MODULE_PATHS = [
  '/node_modules/vue/',
  '/node_modules/vue-router/',
  '/node_modules/pinia/',
  '/node_modules/@vueuse/core/',
]

const SOCKET_MODULE_PATHS = [
  '/node_modules/socket.io-client/',
  '/node_modules/engine.io-client/',
]

const SETTINGS_ROUTE_PATHS = [
  '/src/views/Settings.vue',
  '/src/views/settings/',
]

const RAG_SETTINGS_ROUTE_PATHS = [
  '/src/views/RAGSettings.vue',
  '/src/views/rag/',
]

const POLICY_AUTHORING_ROUTE_PATHS = [
  '/src/views/PolicyList.vue',
  '/src/views/PresetsManager.vue',
]

const POLICY_MAINTENANCE_ROUTE_PATHS = [
  '/src/views/PolicyNativeIntentReconciliation.vue',
  '/src/views/PolicyHistoricRouteSafetyRefresh.vue',
]

const POLICY_INSIGHTS_ROUTE_PATHS = [
  '/src/views/PolicyStatsDashboard.vue',
  '/src/views/TuningSuggestionsDashboard.vue',
  '/src/views/Evidence.vue',
]

function normalizeModuleId(moduleId) {
  return typeof moduleId === 'string'
    ? moduleId.replaceAll('\\', '/')
    : ''
}

function matchesModulePath(moduleId, modulePaths) {
  const normalizedModuleId = normalizeModuleId(moduleId)

  return modulePaths.some(modulePath => normalizedModuleId.includes(modulePath))
}

function createRouteGroup(name, modulePaths) {
  return {
    name,
    test: moduleId => matchesModulePath(moduleId, modulePaths),
    priority: 20,
    // Keep every lazily-loaded route limited to the code its own entry needs.
    entriesAware: true,
    // Retain Rolldown's safe dependency capture behavior to avoid cycles.
    includeDependenciesRecursively: true,
  }
}

/**
 * Return the client-specific Rolldown code-splitting policy.
 *
 * Path tests intentionally normalize Windows separators because the production
 * build can execute on Windows runners as well as Linux container builders.
 */
export function createClientCodeSplitting() {
  return {
    groups: [
      {
        name: 'vue-vendor',
        test: moduleId => matchesModulePath(moduleId, VUE_VENDOR_MODULE_PATHS),
        priority: 30,
      },
      {
        name: 'socket',
        test: moduleId => matchesModulePath(moduleId, SOCKET_MODULE_PATHS),
        priority: 30,
      },
      createRouteGroup('rag-settings', RAG_SETTINGS_ROUTE_PATHS),
      createRouteGroup('settings-route', SETTINGS_ROUTE_PATHS),
      createRouteGroup('policy-authoring', POLICY_AUTHORING_ROUTE_PATHS),
      createRouteGroup('policy-maintenance', POLICY_MAINTENANCE_ROUTE_PATHS),
      createRouteGroup('policy-insights', POLICY_INSIGHTS_ROUTE_PATHS),
    ],
  }
}
