<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-2 text-sm">
    <a
      v-if="!error && safePlexItemLink(data?.url)"
      :href="data.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-block rounded text-blue-300 underline focus-visible:outline focus-visible:outline-2"
    >Open {{ item.title }} in Plex (new tab)</a>
    <template v-else>
      <p role="status">
        {{ isLoading ? 'Checking Plex link…' : 'Plex link unavailable. Search for this title in the listed library, or check again later.' }}
      </p>
      <button
        type="button"
        :disabled="isLoading"
        class="rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
        @click="refresh"
      >
        Check Plex link again
      </button>
    </template>
  </div>
</template>
<script setup>
import { getInventoryRecoveryPlexLink } from '@/api/inventoryRecoveryApi'
import { useSWR } from '@/composables/useSWR'
import { safePlexItemLink } from '@/utils/inventoryRecovery'
const props = defineProps({ item: { type: Object, required: true } })
// Mount only after an explicit details expansion. No polling or persistent link cache.
const { data, error, isLoading, refresh } = useSWR(`inventory-recovery:link:${props.item.id}:${props.item.caseId}`,
  () => getInventoryRecoveryPlexLink(props.item.id, props.item.caseId), { persist: false, autoRetry: false })
</script>
