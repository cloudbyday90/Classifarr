<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <header class="bg-sidebar border-b border-gray-800 px-4 md:px-6 py-4">
    <div class="flex items-center justify-between">
      <!-- Mobile Hamburger Menu -->
      <button 
        @click="$emit('toggleSidebar')"
        class="p-2 -ml-2 text-gray-400 hover:text-white md:hidden"
        aria-label="Open menu"
      >
        <Bars3Icon class="w-6 h-6" />
      </button>

      <!-- Breadcrumbs -->
      <nav class="flex items-center space-x-2 text-sm">
        <router-link to="/" class="text-gray-400 hover:text-white transition-colors">
          Classifarr
        </router-link>
        <span v-if="breadcrumbs.length > 0" class="text-gray-600">/</span>
        <template v-for="(crumb, index) in breadcrumbs" :key="index">
          <router-link 
            v-if="crumb.path && index < breadcrumbs.length - 1"
            :to="crumb.path"
            class="text-gray-400 hover:text-white transition-colors"
          >
            {{ crumb.label }}
          </router-link>
          <span 
            v-else
            class="text-white font-medium"
          >
            {{ crumb.label }}
          </span>
          <span v-if="index < breadcrumbs.length - 1" class="text-gray-600">/</span>
        </template>
      </nav>

      <!-- Time -->
      <div class="flex items-center space-x-4">
        <div class="text-sm text-gray-400 hidden sm:block">
          {{ currentTime }}
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon } from '@heroicons/vue/24/outline'

defineEmits(['toggleSidebar'])

const route = useRoute()
const currentTime = ref(new Date().toLocaleTimeString())

const breadcrumbs = computed(() => {
  const crumbs = []
  
  // Map routes to breadcrumb labels
  const pathMap = {
    '/': { label: 'Dashboard' },
    '/libraries': { label: 'Libraries', path: '/libraries' },
    '/activity': { label: 'Activity' },
    '/history': { label: 'History' },
    '/settings': { label: 'Settings', path: '/settings' },
    '/system': { label: 'System' },
  }

  // Handle dynamic routes
  if (route.path.startsWith('/libraries/') && route.params.id) {
    crumbs.push({ label: 'Libraries', path: '/libraries' })
    crumbs.push({ label: `Library #${route.params.id}` })
  } else if (route.path.startsWith('/rule-builder/') && route.params.libraryId) {
    crumbs.push({ label: 'Libraries', path: '/libraries' })
    crumbs.push({ label: 'Rule Builder' })
  } else if (pathMap[route.path]) {
    const pathInfo = pathMap[route.path]
    if (route.path !== '/') {
      crumbs.push({ label: pathInfo.label, path: pathInfo.path })
    }
  }

  return crumbs
})

let timer
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
