<template>
  <aside class="w-64 bg-sidebar border-r border-gray-800 flex flex-col">
    <div class="p-6">
      <h1 class="text-2xl font-bold text-primary">Classifarr</h1>
      <p class="text-sm text-gray-400 mt-1">AI Media Classification</p>
    </div>
    
    <nav class="flex-1 px-4">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center px-4 py-3 mb-2 rounded-lg transition-colors"
        :class="isActive(item.path) ? 'bg-primary text-white' : 'text-gray-300 hover:bg-background-light'"
      >
        <span class="text-xl mr-3">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="p-4 border-t border-gray-800 text-sm text-gray-400">
      <div>Version 1.0.0</div>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/libraries', label: 'Libraries', icon: '📚' },
  { path: '/history', label: 'History', icon: '📜' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>
