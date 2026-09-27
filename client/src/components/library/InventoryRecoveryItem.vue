<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <li class="rounded-xl border border-gray-600 bg-gray-800 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 break-words">
        <h2 class="text-lg font-semibold">
          {{ item.title }} <span v-if="item.year">({{ item.year }})</span>
        </h2>
        <p class="text-sm text-gray-300">
          {{ item.libraryName }} · {{ item.mediaType === 'tv' ? 'TV show' : 'Movie' }} · TMDb {{ item.tmdbId }}
        </p>
      </div>
      <p class="rounded border border-amber-500 px-3 py-1 text-sm text-amber-200">
        {{ item.diagnosis }}
      </p>
    </div>
    <p class="mt-3 font-medium">
      {{ item.instruction }}
    </p>
    <p class="mt-2 text-sm text-gray-300">
      {{ recoveryRetryLabel(item.retryState) }}<span v-if="item.retryAt"> · {{ recoveryDate(item.retryAt) }}</span>
    </p>
    <details
      class="mt-3"
      @toggle="opened = $event.target.open"
    >
      <summary class="cursor-pointer rounded py-2 text-blue-300 focus-visible:outline focus-visible:outline-2">
        Details and next steps for {{ item.title }}
      </summary>
      <div class="mt-2 space-y-3 border-t border-gray-600 pt-3 text-sm">
        <p>Last check: {{ recoveryDate(item.lastCheckedAt) }} · Completed attempts: {{ item.attemptCount ?? 'Unknown' }}</p>
        <p v-if="item.identityCheck">
          Identity evidence recorded {{ recoveryDate(item.identityCheck.checked_at) }}.
          <span v-if="item.identityCheck.candidate_tmdb_id">Candidate TMDb {{ item.identityCheck.candidate_tmdb_id }} is a review hint, not an applied correction.</span>
        </p>
        <InventoryRecoveryPlexLink
          v-if="opened && item.isPlex && item.caseId"
          :key="item.caseId"
          :item="item"
        />
        <p v-else-if="!item.isPlex">
          Open this title in your media server’s listed library. A direct link is not available for this source.
        </p>
        <ol
          v-if="item.sourceReview"
          class="list-decimal space-y-2 pl-5"
        >
          <li>Follow the action above. Only correct the source match if the title, year or identity is wrong.</li>
          <li v-if="item.isPlex">
            In Plex: open the item → More (…) → Fix Match. For TV, open the show, not a season or episode.
          </li>
          <li>After a correction, let the next Classifarr library sync run. Provider checks resume when their safety gates allow it.</li>
        </ol>
        <p class="text-gray-300">
          Viewing this case never changes identity, starts a retry or routes media.
        </p>
      </div>
    </details>
  </li>
</template>
<script setup>
import { ref } from 'vue'
import InventoryRecoveryPlexLink from './InventoryRecoveryPlexLink.vue'
import { recoveryDate, recoveryRetryLabel } from '@/utils/inventoryRecovery'
defineProps({ item: { type: Object, required: true } })
const opened = ref(false)
</script>
