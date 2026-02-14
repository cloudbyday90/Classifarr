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

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/setup-account',
      name: 'SetupAccount',
      component: () => import('@/views/SetupAccount.vue'),
    },
    {
      path: '/setup',
      name: 'SetupWizard',
      component: () => import('@/views/SetupWizard.vue'),
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'CommandCenter',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/CommandCenter.vue'),
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
          component: () => import('@/views/Libraries.vue'),
        },
        {
          path: '/libraries/:id',
          name: 'LibraryDetail',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/LibraryDetail.vue'),
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
          component: () => import('@/views/History.vue'),
        },
        {
          path: '/notifications',
          name: 'Notifications',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/Notifications.vue'),
        },
        {
          path: '/request',
          name: 'ManualRequest',
          meta: { routeMode: 'compatibility-only' },
          component: () => import('@/views/ManualRequest.vue'),
        },
        {
          path: '/statistics',
          name: 'Statistics',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/Statistics.vue'),
        },
        {
          path: '/settings',
          name: 'Settings',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/Settings.vue'),
        },
        {
          path: '/system',
          name: 'System',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/System.vue'),
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
          component: () => import('@/views/PolicyList.vue'),
        },
        {
          path: '/presets',
          name: 'Presets',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/PresetsManager.vue'),
        },
        {
          path: '/tuning-suggestions',
          name: 'TuningSuggestions',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/TuningSuggestionsDashboard.vue'),
        },
        {
          path: '/policy-stats',
          name: 'PolicyStats',
          meta: { routeMode: 'primary' },
          component: () => import('@/views/PolicyStatsDashboard.vue'),
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
router.beforeEach(async (to, from, next) => {
  // Always allow setup pages through to avoid redirect loops.
  if (to.name === 'SetupAccount' || to.name === 'SetupWizard') {
    next()
    return
  }

  try {
    // Check if user account setup is required
    const setupResponse = await fetch('/api/setup/status')
    const setupData = await setupResponse.json()

    // If no users exist yet, force the initial admin creation flow.
    // This includes redirecting away from /login, which would otherwise be a dead-end.
    if (setupData.setupRequired) {
      if (to.name !== 'SetupAccount') {
        next('/setup-account')
        return
      }
      next()
      return
    }

    // Setup is complete; allow /login, but protect all other routes.
    if (to.name === 'Login') {
      next()
      return
    }

    // Check for valid authentication token
    if (!setupData.setupRequired) {
      const token = localStorage.getItem('auth_token')

      if (!token) {
        // No token, redirect to login with original destination
        next({ name: 'Login', query: { redirect: to.fullPath } })
        return
      }

      // Verify token is still valid
      try {
        const authResponse = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!authResponse.ok) {
          // Token invalid/expired, clear it and redirect to login
          localStorage.removeItem('auth_token')
          next({ name: 'Login', query: { redirect: to.fullPath } })
          return
        }
      } catch (authError) {
        // Auth check failed, redirect to login
        localStorage.removeItem('auth_token')
        next({ name: 'Login', query: { redirect: to.fullPath } })
        return
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
    next()
  } catch (error) {
    console.error('Failed to check setup status:', error)
    next()
  }
})

export default router

