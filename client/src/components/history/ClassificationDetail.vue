<template>
  <div>
    <div class="mb-6">
      <h3 class="text-xl font-bold text-text mb-2">{{ item.title }}</h3>
      <div class="flex items-center space-x-3">
        <Badge variant="primary">{{ item.type }}</Badge>
        <Badge :variant="getConfidenceVariant(item.confidence)">
          {{ item.confidence }}% confidence
        </Badge>
        <Badge :variant="item.corrected ? 'warning' : 'success'">
          {{ item.corrected ? 'Corrected' : 'OK' }}
        </Badge>
      </div>
    </div>
    
    <div class="space-y-4">
      <div>
        <h4 class="text-sm font-semibold text-text-muted mb-1">Library</h4>
        <p class="text-text">{{ item.library }}</p>
      </div>
      
      <div>
        <h4 class="text-sm font-semibold text-text-muted mb-1">Classification Method</h4>
        <p class="text-text">{{ item.method }}</p>
      </div>
      
      <div>
        <h4 class="text-sm font-semibold text-text-muted mb-1">Date</h4>
        <p class="text-text">{{ formatDate(item.date) }}</p>
      </div>
      
      <div v-if="item.labels">
        <h4 class="text-sm font-semibold text-text-muted mb-2">Applied Labels</h4>
        <div class="flex flex-wrap gap-2">
          <Badge v-for="label in item.labels" :key="label" variant="primary">
            {{ label }}
          </Badge>
        </div>
      </div>
      
      <div v-if="item.notes">
        <h4 class="text-sm font-semibold text-text-muted mb-1">Notes</h4>
        <p class="text-text">{{ item.notes }}</p>
      </div>
    </div>
    
    <div v-if="!item.corrected" class="mt-6">
      <Button variant="warning" full-width @click="$emit('correct', item)">
        Mark for Correction
      </Button>
    </div>
  </div>
</template>

<script setup>
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'

defineProps({
  item: {
    type: Object,
    required: true,
  },
})

defineEmits(['correct'])

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'primary'
  if (confidence >= 50) return 'warning'
  return 'error'
}
</script>
