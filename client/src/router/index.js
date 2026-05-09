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

import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/layout/MainLayout.vue'
import api from '@/api'
import CommandCenter from '@/views/CommandCenter.vue'
import Evidence from '@/views/Evidence.vue'
import History from '@/views/History.vue'
import Libraries from '@/views/Libraries.vue'
import LibraryDetail from '@/views/LibraryDetail.vue'
import Login from '@/views/Login.vue'
import ManualRequest from '@/views/ManualRequest.vue'
import Notifications from '@/views/Notifications.vue'
import PolicyList from '@/views/PolicyList.vue'
import PolicyStatsDashboard from '@/views/PolicyStatsDashboard.vue'
import PresetsManager from '@/views/PresetsManager.vue'
import Settings from '@/views/Settings.vue'
import SetupAccount from '@/views/SetupAccount.vue'
import SetupWizard from '@/views/SetupWizard.vue'
import Statistics from '@/views/Statistics.vue'
import System from '@/views/System.vue'
import TuningSuggestionsDashboard from '@/views/TuningSuggestionsDashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
    },
    {
      path: '/setup-account',
      name: 'SetupAccount',
      component: SetupAccount,
    },
    {
      path: '/setup',
      name: 'SetupWizard',
      component: SetupWizard,
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'CommandCenter',
          meta: { routeMode: 'primary' },
          component: CommandCenter,
        },
        // Legacy compatibility route during Command Center migration.
        {
          path: '/dashboard',
          name: 'Dashboard',
          meta: { routeMode: 'compatibility-only', legacy: true },
          redirect: (to) => ({
            path: '/',
            query: {
              ...to.query,
              legacyRoute: 'dashboard',
            },
          }),
        },
        {
          path: '/libraries',
          name: 'Libraries',
          meta: { routeMode: 'primary' },
          component: Libraries,
        },
        {
          path: '/libraries/:id',
          name: 'LibraryDetail',
          meta: { routeMode: 'primary' },
          component: LibraryDetail,
        },
        // REMOVED v0.38.0 - Rule Builder deprecated, using Policy Engine instead
        // Route removed: /rule-builder/:libraryId
        {
          path: '/activity',
          name: 'Activity',
          meta: { routeMode: 'compatibility-only', legacy: true },
          redirect: (to) => ({
            path: '/',
            hash: '#processing',
            query: {
              ...to.query,
              legacyRoute: 'activity',
            },
          }),
        },
        {
          path: '/history',
          name: 'History',
          meta: { routeMode: 'primary' },
          component: History,
        },
        {
          path: '/notifications',
          name: 'Notifications',
          meta: { routeMode: 'primary' },
          component: Notifications,
        },
        {
          path: '/request',
          name: 'ManualRequest',
          meta: { routeMode: 'compatibility-only' },
          component: ManualRequest,
        },
        {
          path: '/statistics',
          name: 'Statistics',
          meta: { routeMode: 'primary' },
          component: Statistics,
        },
        {
          path: '/settings',
          name: 'Settings',
          meta: { routeMode: 'primary' },
          component: Settings,
        },
        {
          path: '/system',
          name: 'System',
          meta: { routeMode: 'primary' },
          component: System,
        },
        {
          path: '/queue',
          name: 'Queue',
          meta: { routeMode: 'compatibility-only', legacy: true },
          redirect: (to) => ({
            path: '/',
            hash: '#processing',
            query: {
              ...to.query,
              legacyRoute: 'queue',
            },
          }),
        },
        // REMOVED v0.38.0 - Patterns replaced by Library Profiles
        // Route removed: /patterns
        {
          path: '/policies',
          name: 'Policies',
          meta: { routeMode: 'primary' },
          component: PolicyList,
        },
        {
          path: '/presets',
          name: 'Presets',
          meta: { routeMode: 'primary' },
          component: PresetsManager,
        },
        {
          path: '/tuning-suggestions',
          name: 'TuningSuggestions',
          meta: { routeMode: 'primary' },
          component: TuningSuggestionsDashboard,
        },
        {
          path: '/evidence',
          name: 'Evidence',
          meta: { routeMode: 'primary' },
          component: Evidence,
        },
        {
          path: '/policy-stats',
          name: 'PolicyStats',
          meta: { routeMode: 'primary' },
          component: PolicyStatsDashboard,
        },
        {
          path: '/migration',
          name: 'Migration',
          meta: { routeMode: 'deprecated-compatibility', legacy: true },
          redirect: (to) => ({
            path: '/',
            query: {
              ...to.query,
              legacyRoute: 'migration',
            },
          }),
        },
      ],
    },
  ],
})

// Navigation guard to check setup status and authentication
router.beforeEach(async (to) => {
  // Always allow setup pages through to avoid redirect loops.
  if (to.name === 'SetupAccount' || to.name === 'SetupWizard') {
    return true
  }

  try {
    // Check if user account setup is required
    const setupData = await api.getSetupStatus()

    // If no users exist yet, force the initial admin creation flow.
    // This includes redirecting away from /login, which would otherwise be a dead-end.
    if (setupData.setupRequired) {
      if (to.name !== 'SetupAccount') {
        return '/setup-account'
      }
      return true
    }

    // Setup is complete; allow /login, but protect all other routes.
    if (to.name === 'Login') {
      return true
    }

    // Check for valid authentication using cookie-based auth.
    // api.getMe() goes through the Axios interceptor: if the access token has
    // expired (e.g. 48 hours elapsed) the interceptor automatically calls
    // /auth/refresh using the httpOnly refresh-token cookie and retries.
    // This ensures Remember Me sessions (30-day refresh token) survive access
    // token expiry without being kicked to /login.
    if (!setupData.setupRequired) {
      try {
        await api.getMe()
      } catch (_authError) {
        // Both the access token and the refresh attempt failed — require login.
        return { name: 'Login', query: { redirect: to.fullPath } }
      }
    }

    // Check if TMDB and other services are configured
    // Check if TMDB and other services are configured
    // Skipping wizard as per user request - only account creation is mandatory
    /*
    const response = await fetch('/api/settings/setup-status')
    const data = await response.json()

    if (!data.setupComplete && to.name !== 'SetupWizard') {
      next('/setup')
    } else {
      next()
    }
    */
    return true
  } catch (error) {
    console.error('Failed to check setup status:', error)
    return true
  }
})

export default router
