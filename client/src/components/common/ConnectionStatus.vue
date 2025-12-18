<template>
  <div v-if="status" :class="['p-4 rounded-lg border', statusClasses]">
    <div class="flex items-start gap-3">
      <div class="text-2xl">{{ statusIcon }}</div>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="font-semibold text-lg">{{ statusTitle }}</h3>
        </div>
        
        <div v-if="status.success && details" class="space-y-2">
          <div class="border-t border-gray-600 pt-2 mt-2">
            <div v-if="details.serverName" class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-gray-400">Server:</div>
              <div class="font-medium">{{ details.serverName }}</div>
            </div>
            <div v-if="details.version" class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-gray-400">Version:</div>
              <div class="font-medium">{{ details.version }}</div>
            </div>
            <div v-if="details.status" class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-gray-400">Status:</div>
              <div class="font-medium">{{ details.status }}</div>
            </div>
            <div v-if="details.platform" class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-gray-400">Platform:</div>
              <div class="font-medium">{{ details.platform }}</div>
            </div>
            
            <!-- Additional Info -->
            <div v-if="details.additionalInfo" class="mt-2">
              <div v-for="(value, key) in details.additionalInfo" :key="key" class="grid grid-cols-2 gap-2 text-sm">
                <div class="text-gray-400">{{ key }}:</div>
                <div class="font-medium">{{ formatValue(value) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!status.success && error" class="mt-2">
          <p class="text-sm text-red-300 mb-2">{{ error.message }}</p>
          <div v-if="error.troubleshooting && error.troubleshooting.length > 0" class="mt-3">
            <p class="text-xs font-semibold text-gray-300 mb-1">Troubleshooting Tips:</p>
            <ul class="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li v-for="(tip, index) in error.troubleshooting" :key="index">{{ tip }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: Object,
    default: null,
  },
})

const statusIcon = computed(() => {
  if (!props.status) return ''
  return props.status.success ? '✅' : '❌'
})

const statusTitle = computed(() => {
  if (!props.status) return ''
  return props.status.success ? 'Connected Successfully' : 'Connection Failed'
})

const statusClasses = computed(() => {
  if (!props.status) return ''
  return props.status.success
    ? 'bg-green-900/30 border-green-700 text-green-100'
    : 'bg-red-900/30 border-red-700 text-red-100'
})

const details = computed(() => props.status?.details || null)
const error = computed(() => props.status?.error || null)

const formatValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return value
}
</script>
