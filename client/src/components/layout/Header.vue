<template>
  <header class="bg-sidebar border-b border-gray-800 px-6 py-4">
    <div class="flex items-center justify-between">
      <!-- Breadcrumb Navigation -->
      <div class="flex items-center space-x-2 text-sm">
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
      </div>

      <!-- Right Side: Time and User Menu -->
      <div class="flex items-center space-x-4">
        <div class="text-sm text-gray-400">
          {{ currentTime }}
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const currentTime = ref(new Date().toLocaleTimeString())

const breadcrumbs = computed(() => {
  const crumbs = []
  const routeName = route.name
  const path = route.path

  // Generate breadcrumbs based on current route
  if (routeName === 'Dashboard' || path === '/') {
    return []
  }

  if (routeName === 'Libraries') {
    crumbs.push({ label: 'Libraries', path: null })
  } else if (routeName === 'LibraryDetail') {
    crumbs.push({ label: 'Libraries', path: '/libraries' })
    crumbs.push({ label: 'Library Details', path: null })
  } else if (routeName === 'RuleBuilder') {
    crumbs.push({ label: 'Libraries', path: '/libraries' })
    crumbs.push({ label: 'Rule Builder', path: null })
  } else if (routeName === 'History') {
    crumbs.push({ label: 'History', path: null })
  } else if (routeName === 'Activity') {
    crumbs.push({ label: 'Activity', path: null })
  } else if (routeName === 'Settings') {
    crumbs.push({ label: 'Settings', path: null })
  } else if (routeName === 'System') {
    crumbs.push({ label: 'System', path: null })
  } else {
    crumbs.push({ label: routeName || 'Page', path: null })
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
