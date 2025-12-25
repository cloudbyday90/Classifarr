<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <aside class="w-64 bg-sidebar border-r border-gray-800 flex flex-col">
    <div class="p-6">
      <h1 class="text-2xl font-bold text-primary">Classifarr</h1>
      <p class="text-sm text-gray-400 mt-1">AI Media Classification</p>
    </div>
    
    <nav class="flex-1 px-2">
      <div class="mb-4">
        <router-link
          v-for="item in mainMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-3 mb-1 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>

      <div class="border-t border-gray-800 my-4"></div>

      <div>
        <router-link
          v-for="item in systemMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-3 mb-1 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-800 text-sm text-gray-400">
      <div>v0.27.5-alpha</div>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'
import {
  HomeIcon,
  FolderIcon,
  ClockIcon,
  DocumentTextIcon,
  CogIcon,
  ServerIcon,
  PlusCircleIcon,
  ChartBarIcon,
  QueueListIcon
} from '@heroicons/vue/24/outline'

const route = useRoute()

const mainMenuItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon },
  { path: '/libraries', label: 'Libraries', icon: FolderIcon },
  { path: '/activity', label: 'Activity', icon: ClockIcon },
  { path: '/history', label: 'History', icon: DocumentTextIcon },
  { path: '/request', label: 'Request', icon: PlusCircleIcon },
  { path: '/statistics', label: 'Statistics', icon: ChartBarIcon },
  { path: '/settings', label: 'Settings', icon: CogIcon },
]

const systemMenuItems = [
  { path: '/queue', label: 'Queue', icon: QueueListIcon },
  { path: '/system', label: 'System', icon: ServerIcon },
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.nav-item {
  @apply text-gray-300 relative;
}

.nav-item:hover {
  @apply bg-background-light;
}

.nav-item.active {
  @apply bg-background-light text-white;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #3b82f6;
  border-radius: 0 2px 2px 0;
}
</style>
