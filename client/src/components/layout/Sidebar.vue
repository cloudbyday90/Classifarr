<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <!-- Desktop: Always visible sidebar -->
  <!-- Mobile: Slide-in overlay when isOpen is true -->
  <aside 
    :class="[
      'fixed md:static inset-y-0 left-0 w-72 md:w-64 bg-sidebar border-r border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out z-50',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    ]"
  >
    <!-- Mobile Close Button -->
    <button 
      @click="$emit('close')"
      class="absolute top-4 right-4 p-2 text-gray-400 hover:text-white md:hidden"
      aria-label="Close menu"
    >
      <XMarkIcon class="w-6 h-6" />
    </button>

    <div class="p-6">
      <h1 class="text-2xl font-bold text-primary">Classifarr</h1>
      <p class="text-sm text-gray-400 mt-1">AI Media Classification</p>
    </div>
    
    <nav class="flex-1 px-2 overflow-y-auto">
      <!-- Dashboard Section -->
      <div class="mb-2">
        <router-link
          to="/"
          class="nav-item group relative flex items-center px-4 py-3 mb-1 transition-colors"
          :class="isActive('/') ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive('/')"></div>
          <HomeIcon class="w-5 h-5 mr-3" />
          <span>Dashboard</span>
        </router-link>
      </div>

      <!-- Media Section -->
      <div class="mb-2">
        <div class="section-header">Media</div>
        <router-link
          v-for="item in mediaMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-2.5 mb-0.5 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Classification Section -->
      <div class="mb-2">
        <div class="section-header">Classification</div>
        <router-link
          v-for="item in classificationMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-2.5 mb-0.5 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Analytics Section -->
      <div class="mb-2">
        <div class="section-header">Analytics</div>
        <router-link
          v-for="item in analyticsMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-2.5 mb-0.5 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Admin Section -->
      <div class="mb-2">
        <div class="section-header">Admin</div>
        <router-link
          v-for="item in adminMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-2.5 mb-0.5 transition-colors"
          :class="isActive(item.path) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-800 text-sm text-gray-400">
      <div>v0.37.0-alpha</div>
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
  QueueListIcon,
  PuzzlePieceIcon,
  XMarkIcon,
  LightBulbIcon,
  PresentationChartLineIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const route = useRoute()

// Media section
const mediaMenuItems = [
  { path: '/libraries', label: 'Libraries', icon: FolderIcon },
  { path: '/request', label: 'Request', icon: PlusCircleIcon },
  { path: '/activity', label: 'Activity', icon: ClockIcon },
]

// Classification section
const classificationMenuItems = [
  { path: '/policies', label: 'Policies', icon: DocumentDuplicateIcon },
  { path: '/patterns', label: 'Patterns', icon: PuzzlePieceIcon },
  { path: '/tuning-suggestions', label: 'Tuning', icon: LightBulbIcon },
]

// Analytics section
const analyticsMenuItems = [
  { path: '/history', label: 'History', icon: DocumentTextIcon },
  { path: '/statistics', label: 'Statistics', icon: ChartBarIcon },
  { path: '/policy-stats', label: 'Policy Stats', icon: PresentationChartLineIcon },
]

// Admin section
const adminMenuItems = [
  { path: '/migration', label: 'Migration', icon: ArrowPathIcon },
  { path: '/queue', label: 'Queue', icon: QueueListIcon },
  { path: '/settings', label: 'Settings', icon: CogIcon },
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
.section-header {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2 mt-2;
}

.nav-item {
  @apply text-gray-300 relative rounded-md text-sm;
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
  width: 3px;
  background-color: #3b82f6;
  border-radius: 0 2px 2px 0;
}
</style>
