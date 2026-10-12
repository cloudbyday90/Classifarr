<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-if="hasIncompleteConfigs"
    class="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-6"
  >
    <div class="flex items-start gap-3">
      <span
        class="text-2xl"
        aria-hidden="true"
      >⚠️</span>
      <div class="flex-1">
        <h3 class="font-semibold text-yellow-400 mb-2">
          Incomplete Configuration Detected
        </h3>
        <div
          v-for="config in incompleteConfigs"
          :key="`${config.type}-${config.id}`"
          class="mb-2"
        >
          <p class="text-sm text-gray-300">
            Your <strong>{{ config.name }}</strong> configuration is missing a Quality Profile. 
            Content won't be added to {{ config.type }} until you select one.
          </p>
          <RouterLink
            class="inline-block mt-2 text-sm px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-md transition-colors font-medium"
            :to="config.route"
          >
            Configure {{ config.type }} Now
          </RouterLink>
        </div>
      </div>
      <button
        class="text-gray-400 hover:text-white transition-colors"
        title="Dismiss"
        type="button"
        aria-label="Dismiss incomplete configuration warning"
        :onClick="dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { parseArrConfigWarnings } from '@/utils/arrConfigWarning'

const props = defineProps({
  loadStatus: {
    type: /** @type {import('vue').PropType<() => Promise<unknown>>} */ (Function),
    required: true,
  },
})
/** @type {import('vue').Ref<import('@/utils/arrConfigWarning').ArrConfigWarning[]>} */
const incompleteConfigs = ref([])
const dismissed = ref(false)
const hasIncompleteConfigs = computed(() => !dismissed.value && incompleteConfigs.value.length > 0)
let unmounted = false

onUnmounted(() => { unmounted = true })

onMounted(async () => {
  try {
    const response = await props.loadStatus()
    if (!unmounted) incompleteConfigs.value = parseArrConfigWarnings(response)
  } catch {
    // This optional warning must not expose raw transport errors or credentials.
    if (!unmounted) console.error('Failed to check arr config status')
  }
})

const dismiss = () => {
  dismissed.value = true
}
</script>
