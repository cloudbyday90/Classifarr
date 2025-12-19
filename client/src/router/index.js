/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
        },
        {
          path: '/libraries',
          name: 'Libraries',
          component: () => import('@/views/Libraries.vue'),
        },
        {
          path: '/libraries/:id',
          name: 'LibraryDetail',
          component: () => import('@/views/LibraryDetail.vue'),
        },
        {
          path: '/rule-builder/:libraryId',
          name: 'RuleBuilder',
          component: () => import('@/views/RuleBuilder.vue'),
        },
        {
          path: '/activity',
          name: 'Activity',
          component: () => import('@/views/Activity.vue'),
        },
        {
          path: '/history',
          name: 'History',
          component: () => import('@/views/History.vue'),
        },
        {
          path: '/settings',
          name: 'Settings',
          component: () => import('@/views/Settings.vue'),
        },
        {
          path: '/system',
          name: 'System',
          component: () => import('@/views/System.vue'),
        },
      ],
    },
  ],
})

// Navigation guard to check setup status
router.beforeEach(async (to, from, next) => {
  // Skip for setup pages
  if (to.name === 'SetupAccount' || to.name === 'SetupWizard') {
    next()
    return
  }

  try {
    // Check if user account setup is required
    const setupResponse = await fetch('/api/setup/status')
    const setupData = await setupResponse.json()
    
    if (setupData.setupRequired && to.name !== 'SetupAccount') {
      next('/setup-account')
      return
    }

    // Check if TMDB and other services are configured
    const response = await fetch('/api/settings/setup-status')
    const data = await response.json()
    
    if (!data.setupComplete && to.name !== 'SetupWizard') {
      next('/setup')
    } else {
      next()
    }
  } catch (error) {
    console.error('Failed to check setup status:', error)
    next()
  }
})

export default router
