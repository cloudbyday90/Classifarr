import { defineAsyncComponent } from 'vue'

import AI from './AI.vue'
import Backup from './Backup.vue'
import Confidence from './Confidence.vue'
import Discord from './Discord.vue'
import General from './General.vue'
import Logs from './Logs.vue'
import MediaServer from './MediaServer.vue'
import OMDb from './OMDb.vue'
import Profile from './Profile.vue'
import Queue from './Queue.vue'
import Radarr from './Radarr.vue'
import RatingNormalization from './RatingNormalization.vue'
import Scheduler from './Scheduler.vue'
import Security from './Security.vue'
import Sonarr from './Sonarr.vue'
import SSL from './SSL.vue'
import Tavily from './Tavily.vue'
import TMDB from './TMDB.vue'
import Webhooks from './Webhooks.vue'

const RAGSettings = defineAsyncComponent({
  loader: () => import('../RAGSettings.vue'),
  suspensible: false,
})

export const settingsGroups = [
  {
    name: 'General',
    tabs: [
      { id: 'general', label: 'General', icon: '⚙️', component: General },
      { id: 'scheduler', label: 'Scheduler', icon: '🕐', component: Scheduler },
      { id: 'queue', label: 'Queue', icon: '📋', component: Queue },
    ],
  },
  {
    name: 'Connections',
    tabs: [
      { id: 'mediaserver', label: 'Media Server', icon: '🖥️', component: MediaServer },
      { id: 'radarr', label: 'Radarr', icon: '🎬', component: Radarr },
      { id: 'sonarr', label: 'Sonarr', icon: '📺', component: Sonarr },
    ],
  },
  {
    name: 'Metadata',
    tabs: [
      { id: 'tmdb', label: 'TMDB', icon: '🎞️', component: TMDB },
      { id: 'omdb', label: 'OMDb', icon: '🎬', component: OMDb },
      { id: 'tavily', label: 'Tavily', icon: '🔍', component: Tavily },
      { id: 'rating-normalization', label: 'Rating Normalization', icon: '⭐', component: RatingNormalization },
    ],
  },
  {
    name: 'Classification',
    tabs: [
      { id: 'ai', label: 'AI', icon: '🤖', component: AI },
      { id: 'confidence', label: 'Confidence', icon: '📊', component: Confidence },
      { id: 'rag', label: 'RAG & Embeddings', icon: '🧠', component: RAGSettings },
    ],
  },
  {
    name: 'Notifications',
    tabs: [
      { id: 'discord', label: 'Discord', icon: '💬', component: Discord },
      { id: 'webhooks', label: 'Webhooks', icon: '🔗', component: Webhooks },
    ],
  },
  {
    name: 'System',
    tabs: [
      { id: 'profile', label: 'Profile', icon: '👤', component: Profile },
      { id: 'security', label: 'Security', icon: '🔑', component: Security },
      { id: 'backup', label: 'Backup', icon: '💾', component: Backup },
      { id: 'ssl', label: 'SSL/HTTPS', icon: '🔒', component: SSL },
      { id: 'logs', label: 'Logs', icon: '📝', component: Logs },
    ],
  },
]

const settingsTabs = settingsGroups.flatMap((group) => group.tabs)
const settingsTabMap = new Map(settingsTabs.map((tab) => [tab.id, tab]))

export function hasSettingsTab(tabId) {
  return settingsTabMap.has(tabId)
}

export function resolveSettingsTabComponent(tabId) {
  return settingsTabMap.get(tabId)?.component
}
