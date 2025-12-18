import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/components/layout/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true }
    },
    {
      path: '/setup',
      name: 'SetupWizard',
      component: () => import('@/views/SetupWizard.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { permission: 'can_view_dashboard' }
        },
        {
          path: '/libraries',
          name: 'Libraries',
          component: () => import('@/views/Libraries.vue'),
          meta: { permission: 'can_view_dashboard' }
        },
        {
          path: '/libraries/:id',
          name: 'LibraryDetail',
          component: () => import('@/views/LibraryDetail.vue'),
          meta: { permission: 'can_view_dashboard' }
        },
        {
          path: '/rule-builder/:libraryId',
          name: 'RuleBuilder',
          component: () => import('@/views/RuleBuilder.vue'),
          meta: { permission: 'can_manage_libraries' }
        },
        {
          path: '/history',
          name: 'History',
          component: () => import('@/views/History.vue'),
          meta: { permission: 'can_view_history' }
        },
        {
          path: '/settings',
          name: 'Settings',
          component: () => import('@/views/Settings.vue'),
          meta: { permission: 'can_manage_settings' }
        },
        {
          path: '/users',
          name: 'Users',
          component: () => import('@/views/Users.vue'),
          meta: { permission: 'can_manage_users' }
        },
      ],
    },
    {
      path: '/unauthorized',
      name: 'Unauthorized',
      component: () => import('@/views/Unauthorized.vue'),
      meta: { public: true }
    }
  ],
})

// Navigation guard for authentication and authorization
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Public routes
  if (to.meta.public) {
    // If already authenticated and trying to access login, redirect to dashboard
    if (to.name === 'Login' && authStore.isAuthenticated) {
      next({ name: 'Dashboard' })
      return
    }
    next()
    return
  }

  // Check setup status for non-public routes
  if (to.name !== 'SetupWizard') {
    try {
      const response = await fetch('/api/settings/setup-status')
      const data = await response.json()
      
      if (!data.setupComplete) {
        next('/setup')
        return
      }
    } catch (error) {
      console.error('Failed to check setup status:', error)
    }
  }

  // Check authentication
  if (!authStore.isAuthenticated) {
    next({ 
      name: 'Login', 
      query: { redirect: to.fullPath } 
    })
    return
  }

  // Fetch user if not loaded
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      console.error('Failed to fetch user:', error)
      next({ 
        name: 'Login', 
        query: { redirect: to.fullPath } 
      })
      return
    }
  }

  // Check permissions
  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    next({ name: 'Unauthorized' })
    return
  }

  next()
})

export default router
