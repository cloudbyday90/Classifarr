<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-700">
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-4 py-3 text-left text-sm font-medium text-gray-400"
            :class="{ 'cursor-pointer hover:text-gray-200': column.sortable }"
            @click="column.sortable && toggleSort(column.key)"
          >
            <div class="flex items-center gap-2">
              {{ column.label }}
              <span v-if="column.sortable && sortKey === column.key">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </div>
          </th>
          <th v-if="$slots.actions" class="px-4 py-3 text-right text-sm font-medium text-gray-400">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in sortedData"
          :key="row.id || index"
          class="border-b border-gray-800 hover:bg-background-light transition-colors"
        >
          <td v-for="column in columns" :key="column.key" class="px-4 py-3">
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
          <td v-if="$slots.actions" class="px-4 py-3 text-right">
            <slot name="actions" :row="row" />
          </td>
        </tr>
        <tr v-if="data.length === 0">
          <td :colspan="columns.length + ($slots.actions ? 1 : 0)" class="px-4 py-8 text-center text-gray-500">
            {{ emptyMessage }}
          </td>
        </tr>
      </tbody>
    </table>
    
    <!-- Pagination -->
    <div v-if="pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-700">
      <div class="text-sm text-gray-400">
        Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalItems) }} of {{ totalItems }}
      </div>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" :disabled="currentPage <= 1" @click="$emit('page-change', currentPage - 1)">
          Previous
        </Button>
        <Button size="sm" variant="secondary" :disabled="currentPage >= totalPages" @click="$emit('page-change', currentPage + 1)">
          Next
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from './Button.vue'

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] },
  emptyMessage: { type: String, default: 'No data available' },
  pagination: { type: Boolean, default: false },
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  totalItems: { type: Number, default: 0 }
})

defineEmits(['page-change', 'sort-change'])

const sortKey = ref(null)
const sortOrder = ref('asc')

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

const sortedData = computed(() => {
  if (!sortKey.value) return props.data
  return [...props.data].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]
    const modifier = sortOrder.value === 'asc' ? 1 : -1
    if (aVal < bVal) return -1 * modifier
    if (aVal > bVal) return 1 * modifier
    return 0
  })
})

const totalPages = computed(() => Math.ceil(props.totalItems / props.pageSize))
</script>
