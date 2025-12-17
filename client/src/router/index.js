import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
      children: [
        {
          path: 'general',
          name: 'SettingsGeneral',
          component: () => import('../views/settings/General.vue')
        },
        {
          path: 'tmdb',
          name: 'SettingsTMDB',
          component: () => import('../views/settings/TMDB.vue')
        },
        {
          path: 'ollama',
          name: 'SettingsOllama',
          component: () => import('../views/settings/Ollama.vue')
        },
        {
          path: 'discord',
          name: 'SettingsDiscord',
          component: () => import('../views/settings/Discord.vue')
        },
        {
          path: 'webhooks',
          name: 'SettingsWebhooks',
          component: () => import('../views/settings/Webhooks.vue')
        }
      ]
    },
    {
      path: '/setup',
      name: 'SetupWizard',
      component: () => import('../views/SetupWizard.vue')
    }
  ]
})

export default router
