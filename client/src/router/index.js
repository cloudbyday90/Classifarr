import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/layout/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
          path: '/settings/webhook',
          name: 'WebhookSettings',
          component: () => import('@/views/settings/Webhook.vue'),
        },
      ],
    },
  ],
})

export default router
