<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-if="notice"
    class="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="font-semibold text-warning mb-1">
          pgvector generic mode reported
        </h3>
        <p class="text-sm text-gray-300">
          {{ notice }} Keep compatibility and container security safeguards enabled.
        </p>
      </div>
      <Button
        size="sm"
        variant="warning"
        type="button"
        :on-click.camel="dismiss"
      >
        Dismiss pgvector notice
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Button from '@/components/common/Button.vue'
import { getPgvectorVariantNotice } from '@/utils/pgvectorVariantNotice'
import { dismissForSession, isSessionDismissed } from '@/utils/sessionDismissal'

const props = defineProps({
  loadStatus: {
    type: /** @type {import('vue').PropType<() => Promise<unknown>>} */ (Function),
    required: true,
  },
})
/** @type {import('vue').Ref<string | null>} */
const notice = ref(null)
const dismissedKey = 'pgvectorVariantBannerDismissed'
let unmounted = false
onUnmounted(() => { unmounted = true })

const dismiss = () => {
  notice.value = null
  dismissForSession(dismissedKey)
}

onMounted(async () => {
  if (isSessionDismissed(dismissedKey)) return

  try {
    const response = await props.loadStatus()
    if (!unmounted) notice.value = getPgvectorVariantNotice(response)
  } catch {
    // Ignore banner if status call fails
  }
})
</script>
