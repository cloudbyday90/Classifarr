<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Settings</h1>

    <!-- Settings Navigation -->
    <div class="flex gap-2 border-b border-gray-700">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="px-4 py-2 rounded-t transition-colors"
        :class="isActive(tab.path) ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'"
      >
        <span class="mr-2">{{ tab.icon }}</span>
        {{ tab.name }}
      </router-link>
    </div>

    <!-- Settings Content -->
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { name: 'General', path: '/settings', icon: '⚙️' },
  { name: 'Confidence', path: '/settings/confidence', icon: '🎯' },
]

const isActive = (path) => {
  if (path === '/settings') {
    return route.path === '/settings'
  }
  return route.path.startsWith(path)
}
</script>
