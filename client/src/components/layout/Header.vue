<template>
  <header class="bg-sidebar border-b border-gray-700 px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <button 
          @click="appStore.toggleSidebar"
          class="text-text-muted hover:text-text transition-colors"
        >
          <Bars3Icon class="w-6 h-6" />
        </button>
        
        <nav class="flex items-center space-x-2 text-sm">
          <span 
            v-for="(crumb, index) in breadcrumbs" 
            :key="index"
            class="flex items-center"
          >
            <ChevronRightIcon v-if="index > 0" class="w-4 h-4 text-text-muted mx-2" />
            <router-link
              v-if="crumb.path"
              :to="crumb.path"
              class="text-text-muted hover:text-text transition-colors"
            >
              {{ crumb.name }}
            </router-link>
            <span v-else class="text-text">{{ crumb.name }}</span>
          </span>
        </nav>
      </div>

      <div class="flex items-center space-x-4">
        <Spinner v-if="appStore.loading" class="w-5 h-5" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { Bars3Icon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import Spinner from '@/components/common/Spinner.vue'

const route = useRoute()
const appStore = useAppStore()

const breadcrumbs = computed(() => {
  const crumbs = []
  const paths = route.path.split('/').filter(Boolean)
  
  if (paths.length === 0) {
    crumbs.push({ name: 'Dashboard', path: null })
  } else {
    crumbs.push({ name: 'Home', path: '/' })
    
    paths.forEach((path, index) => {
      const fullPath = '/' + paths.slice(0, index + 1).join('/')
      const name = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ')
      
      if (index === paths.length - 1) {
        crumbs.push({ name, path: null })
      } else {
        crumbs.push({ name, path: fullPath })
      }
    })
  }
  
  return crumbs
})
</script>
