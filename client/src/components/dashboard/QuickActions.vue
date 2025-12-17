<template>
  <Card title="Quick Actions">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button
        v-for="action in actions"
        :key="action.name"
        class="flex items-center space-x-3 p-4 bg-background rounded-lg hover:bg-gray-800 transition-colors text-left"
        @click="action.action"
      >
        <component :is="action.icon" class="w-6 h-6 text-primary" />
        <div>
          <p class="text-text font-medium">{{ action.name }}</p>
          <p class="text-text-muted text-sm">{{ action.description }}</p>
        </div>
      </button>
    </div>
  </Card>
</template>

<script setup>
import { useRouter } from 'vue-router'
import Card from '@/components/common/Card.vue'
import {
  ArrowPathIcon,
  FolderPlusIcon,
  Cog6ToothIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()

const actions = [
  {
    name: 'Sync Libraries',
    description: 'Refresh library list from media server',
    icon: ArrowPathIcon,
    action: () => {
      // Trigger library sync
      console.log('Sync libraries')
    },
  },
  {
    name: 'Configure Library',
    description: 'Set up classification rules',
    icon: FolderPlusIcon,
    action: () => {
      router.push('/libraries')
    },
  },
  {
    name: 'View Reports',
    description: 'Classification statistics and history',
    icon: ChartBarIcon,
    action: () => {
      router.push('/history')
    },
  },
  {
    name: 'Settings',
    description: 'Configure media servers and AI',
    icon: Cog6ToothIcon,
    action: () => {
      router.push('/settings')
    },
  },
]
</script>
