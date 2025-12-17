import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/layout/MainLayout.vue'
import Dashboard from '@/views/Dashboard.vue'
import Libraries from '@/views/Libraries.vue'
import LibraryDetail from '@/views/LibraryDetail.vue'
import History from '@/views/History.vue'
import RuleBuilder from '@/views/RuleBuilder.vue'
import Settings from '@/views/settings/Settings.vue'
import General from '@/views/settings/General.vue'
import MediaServer from '@/views/settings/MediaServer.vue'
import Radarr from '@/views/settings/Radarr.vue'
import Sonarr from '@/views/settings/Sonarr.vue'
import Ollama from '@/views/settings/Ollama.vue'
import Notifications from '@/views/settings/Notifications.vue'

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: Dashboard,
      },
      {
        path: 'libraries',
        name: 'libraries',
        component: Libraries,
      },
      {
        path: 'libraries/:id',
        name: 'library-detail',
        component: LibraryDetail,
      },
      {
        path: 'libraries/:id/rules/new',
        name: 'rule-builder',
        component: RuleBuilder,
      },
      {
        path: 'history',
        name: 'history',
        component: History,
      },
      {
        path: 'settings',
        component: Settings,
        redirect: '/settings/general',
        children: [
          {
            path: 'general',
            name: 'settings-general',
            component: General,
          },
          {
            path: 'media-server',
            name: 'settings-media-server',
            component: MediaServer,
          },
          {
            path: 'radarr',
            name: 'settings-radarr',
            component: Radarr,
          },
          {
            path: 'sonarr',
            name: 'settings-sonarr',
            component: Sonarr,
          },
          {
            path: 'ollama',
            name: 'settings-ollama',
            component: Ollama,
          },
          {
            path: 'notifications',
            name: 'settings-notifications',
            component: Notifications,
          },
        ],
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
