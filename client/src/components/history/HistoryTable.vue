<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-sidebar border-b border-gray-700">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Date</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Title</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Type</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Library</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Confidence</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Method</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-text">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700">
        <tr
          v-for="item in items"
          :key="item.id"
          class="hover:bg-card transition-colors cursor-pointer"
          @click="$emit('select', item)"
        >
          <td class="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
            {{ formatDate(item.date) }}
          </td>
          <td class="px-4 py-3 text-sm text-text">{{ item.title }}</td>
          <td class="px-4 py-3 text-sm">
            <Badge variant="primary">{{ item.type }}</Badge>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ item.library }}</td>
          <td class="px-4 py-3 text-sm">
            <Badge :variant="getConfidenceVariant(item.confidence)">
              {{ item.confidence }}%
            </Badge>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ item.method }}</td>
          <td class="px-4 py-3 text-sm">
            <Badge :variant="item.corrected ? 'warning' : 'success'">
              {{ item.corrected ? 'Corrected' : 'OK' }}
            </Badge>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div v-if="items.length === 0" class="text-center py-12 text-text-muted">
      No classification history found
    </div>
  </div>
</template>

<script setup>
import Badge from '@/components/common/Badge.vue'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['select'])

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'primary'
  if (confidence >= 50) return 'warning'
  return 'error'
}
</script>
