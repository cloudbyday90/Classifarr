<template>
  <aside 
    :class="[
      'bg-sidebar text-text flex flex-col h-screen transition-all duration-300',
      sidebarCollapsed ? 'w-20' : 'w-64'
    ]"
  >
    <!-- Header -->
    <div class="p-4 border-b border-gray-700">
      <div class="flex items-center justify-between">
        <div v-if="!sidebarCollapsed" class="flex items-center space-x-2">
          <FilmIcon class="w-8 h-8 text-primary" />
          <span class="text-xl font-bold">{{ appName }}</span>
        </div>
        <FilmIcon v-else class="w-8 h-8 text-primary mx-auto" />
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4">
      <div class="space-y-1 px-2">
        <router-link
          v-for="item in mainNavItems"
          :key="item.name"
          :to="item.path"
          class="nav-item"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span v-if="!sidebarCollapsed">{{ item.name }}</span>
        </router-link>
      </div>

      <div class="my-4 border-t border-gray-700"></div>
      
      <div v-if="!sidebarCollapsed" class="px-4 py-2 text-xs text-text-muted font-semibold uppercase tracking-wider">
        Settings
      </div>

      <div class="space-y-1 px-2">
        <router-link
          v-for="item in settingsNavItems"
          :key="item.name"
          :to="item.path"
          class="nav-item"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span v-if="!sidebarCollapsed">{{ item.name }}</span>
        </router-link>
      </div>
    </nav>

    <!-- Footer -->
    <div class="p-4 border-t border-gray-700">
      <div v-if="!sidebarCollapsed" class="text-sm text-text-muted text-center">
        v{{ version }}
      </div>
      <div v-else class="text-xs text-text-muted text-center">
        v{{ version.split('.')[0] }}
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  FilmIcon,
  ChartBarIcon,
  FolderIcon,
  ClockIcon,
  CogIcon,
  TvIcon,
  ServerIcon,
  BellIcon,
  CpuChipIcon,
} from '@heroicons/vue/24/outline'

const appStore = useAppStore()
const appName = computed(() => appStore.appName)
const version = computed(() => appStore.version)
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)

const mainNavItems = [
  { name: 'Dashboard', path: '/', icon: ChartBarIcon },
  { name: 'Libraries', path: '/libraries', icon: FolderIcon },
  { name: 'History', path: '/history', icon: ClockIcon },
]

const settingsNavItems = [
  { name: 'General', path: '/settings/general', icon: CogIcon },
  { name: 'Media Server', path: '/settings/media-server', icon: ServerIcon },
  { name: 'Radarr', path: '/settings/radarr', icon: FilmIcon },
  { name: 'Sonarr', path: '/settings/sonarr', icon: TvIcon },
  { name: 'AI / Ollama', path: '/settings/ollama', icon: CpuChipIcon },
  { name: 'Notifications', path: '/settings/notifications', icon: BellIcon },
]
</script>

<style scoped>
.nav-item {
  @apply flex items-center space-x-3 px-3 py-2 rounded-lg text-text-muted hover:bg-card hover:text-text transition-colors duration-200;
}

.nav-item.router-link-active {
  @apply bg-primary/20 text-primary;
}
</style>
