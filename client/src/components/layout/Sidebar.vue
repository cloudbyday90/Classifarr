<template>
  <aside class="w-64 bg-sidebar border-r border-gray-800 flex flex-col">
    <div class="p-6">
      <h1 class="text-2xl font-bold text-primary">Classifarr</h1>
      <p class="text-sm text-gray-400 mt-1">AI Media Classification</p>
    </div>
    
    <nav class="flex-1 px-3">
      <!-- Main Navigation -->
      <div class="space-y-1 mb-4">
        <router-link
          v-for="item in mainMenuItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center px-3 py-2.5 relative group transition-all duration-200"
          :class="isActive(item.path) 
            ? 'bg-gray-800/50 text-white border-l-4 border-primary' 
            : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200 border-l-4 border-transparent'"
        >
          <component :is="item.icon" class="w-5 h-5 mr-3 flex-shrink-0" />
          <span class="text-sm font-medium">{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-800 my-4"></div>

      <!-- System Navigation -->
      <div class="space-y-1">
        <router-link
          v-for="item in systemMenuItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center px-3 py-2.5 relative group transition-all duration-200"
          :class="isActive(item.path) 
            ? 'bg-gray-800/50 text-white border-l-4 border-primary' 
            : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200 border-l-4 border-transparent'"
        >
          <component :is="item.icon" class="w-5 h-5 mr-3 flex-shrink-0" />
          <span class="text-sm font-medium">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-800 text-sm text-gray-400">
      <div>Version 1.0.0</div>
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
  ServerIcon 
} from '@heroicons/vue/24/outline'

const route = useRoute()

const mainMenuItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon },
  { path: '/libraries', label: 'Libraries', icon: FolderIcon },
  { path: '/activity', label: 'Activity', icon: ClockIcon },
  { path: '/history', label: 'History', icon: DocumentTextIcon },
]

const systemMenuItems = [
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
