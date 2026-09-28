<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="rounded-lg border border-gray-600 bg-gray-800 p-4 space-y-3"
    aria-label="Library discovery status"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="font-semibold">
        Library discovery
      </h3>
      <button
        type="button"
        class="px-3 py-2 rounded border border-gray-500 focus-visible:outline focus-visible:outline-2"
        :disabled="isLoading"
        @click="refresh"
      >
        Refresh status
      </button>
    </div>
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p v-if="isOffline">
        Offline — reconnect to check discovery status.
      </p>
      <p v-else-if="error">
        Status unavailable — check your administrator session and try Refresh status.
      </p>
      <p v-else-if="isLoading || isStale">
        Checking the saved discovery result…
      </p>
      <template v-else-if="data">
        <p class="font-semibold flex items-center gap-2">
          <span aria-hidden="true">{{ data.reason === 'complete' ? '✓' : data.reason === 'checking' ? '◷' : '!' }}</span>
          {{ data.title }}
        </p>
        <p class="text-sm mt-2">
          {{ data.nextStep }}
        </p>
        <p class="text-sm mt-2">
          {{ recoveryMessage }}
        </p>
        <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
          <div>
            <dt class="text-gray-400">
              Saved server
            </dt><dd>{{ providerName }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">
              Last successful discovery
            </dt><dd>
              <time
                v-if="data.lastSuccessAt"
                :datetime="data.lastSuccessAt"
              >{{ formatDate(data.lastSuccessAt) }}</time><span v-else>Not recorded for this connection</span>
            </dd>
          </div>
          <div>
            <dt class="text-gray-400">
              Movie / TV libraries at that scan
            </dt><dd>{{ data.lastSuccessCount ?? 'Not measured' }}</dd>
          </div>
        </dl>
      </template>
    </div>
    <details
      v-if="data && !isOffline && !error && !isLoading && !isStale"
      class="text-sm"
    >
      <summary class="cursor-pointer">
        Scan details
      </summary>
      <p>Last attempt: {{ formatDate(data.attemptedAt) }}. API: {{ contractName }}<span v-if="data.httpStatus">. HTTP {{ data.httpStatus }}</span>.</p>
    </details>
    <button
      type="button"
      class="px-3 py-2 rounded bg-blue-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
      :disabled="syncing || isLoading || !!error || isOffline || isStale || !data?.provider || data.reason === 'checking'"
      @click="$emit('sync')"
    >
      {{ syncing ? 'Syncing libraries…' : 'Sync Libraries' }}
    </button>
    <p class="text-xs text-gray-400">
      Refresh status is read-only. Sync Libraries starts enabled-library content sync and queue refill. Ingestion and backfill have separate progress.
    </p>
  </section>
</template>
<script setup>
import { computed, watch } from 'vue'
import { useSWR } from '@/composables/useSWR'
import { getLibraryDiscoveryStatus } from '@/api/mediaServerSetupApi'
const props = defineProps({ refreshKey: { type: Number, default: 0 }, syncing: Boolean })
defineEmits(['sync'])
const { data, isLoading, isStale, isOffline, error, refresh } = useSWR('library-discovery-status', getLibraryDiscoveryStatus, { persist: false, autoRetry: false })
watch(() => props.refreshKey, () => refresh())
const providerName = computed(() => ({ plex: 'Plex', emby: 'Emby', jellyfin: 'Jellyfin' }[data.value?.provider] ?? 'Not configured'))
const contractName = computed(() => ({ plex_sections: 'Plex sections', emby_query: 'Emby paginated query', emby_legacy: 'Emby legacy array', jellyfin_virtual_folders: 'Jellyfin virtual folders' }[data.value?.contract] ?? 'Not recorded'))
const formatDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Not recorded'
const recoveryMessage = computed(() => {
  const recovery = data.value?.recovery
  if (recovery?.state === 'cooldown') return `Repeated failures: automatic discovery has slowed to one check per six hours, eligible after ${formatDate(recovery.nextAttemptAt)}.`
  if (recovery?.state === 'scheduled') return `Automatic discovery: eligible after ${formatDate(recovery.nextAttemptAt)}; checked about every five minutes.`
  if (recovery?.state === 'waiting_configuration') return 'Automatic discovery is waiting for updated connection settings. You can also retry explicitly with Sync Libraries.'
  if (recovery?.state === 'needs_review') return 'Automatic discovery is paused for review. Follow the recovery step above, then use Sync Libraries.'
  if (recovery?.state === 'pending') return 'Automatic discovery will check the saved connection on the next watchdog run.'
  return 'Automatic discovery waits until a media server is configured.'
})
</script>
