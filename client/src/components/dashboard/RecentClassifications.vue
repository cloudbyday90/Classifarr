<template>
  <Card title="Recent Classifications">
    <div v-if="loading" class="flex justify-center py-8">
      <Spinner class="w-8 h-8" />
    </div>
    
    <div v-else-if="classifications.length === 0" class="text-center py-8 text-text-muted">
      No recent classifications
    </div>
    
    <div v-else class="space-y-3">
      <div
        v-for="item in classifications"
        :key="item.id"
        class="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
        @click="$emit('select', item)"
      >
        <div class="flex-1">
          <p class="text-text font-medium">{{ item.title }}</p>
          <div class="flex items-center space-x-2 mt-1">
            <Badge variant="primary">{{ item.type }}</Badge>
            <Badge :variant="item.corrected ? 'warning' : 'success'">
              {{ item.confidence }}% confidence
            </Badge>
            <span class="text-text-muted text-sm">{{ formatDate(item.date) }}</span>
          </div>
        </div>
        <ChevronRightIcon class="w-5 h-5 text-text-muted" />
      </div>
    </div>
    
    <div v-if="classifications.length > 0" class="mt-4 text-center">
      <router-link to="/history" class="text-primary hover:text-blue-400 text-sm font-medium">
        View all →
      </router-link>
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Spinner from '@/components/common/Spinner.vue'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  classifications: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['select'])

const formatDate = (date) => {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return d.toLocaleDateString()
  }
}
</script>
