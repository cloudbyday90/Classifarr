<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="space-y-3 rounded-lg border border-gray-600 p-4"
    aria-label="How to resolve skipped Plex items"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-semibold">
        How to resolve
      </h3>
      <button
        type="button"
        class="rounded-sm px-2 py-1 text-sm text-blue-300 underline focus-visible:outline focus-visible:outline-2"
        :aria-pressed="paused"
        @click="togglePaused"
      >
        {{ paused ? 'Resume automatic updates' : 'Pause automatic updates' }}
      </button>
    </div>
    <p>{{ current.explanation }}</p>
    <p class="text-sm text-gray-300">
      {{ current.scope }}
    </p>
    <p
      v-if="error"
      role="status"
      class="text-sm text-amber-300"
    >
      Could not refresh these details. Showing the last result; automatic updates will retry.
    </p>
    <p
      v-if="current.status === 'unavailable'"
      role="status"
    >
      Current item details could not be loaded. Refreshing this report retries automatically.
    </p>
    <p
      v-else-if="current.status === 'no_current_records'"
      role="status"
    >
      No current matching unresolved records were found. They may have been repaired, removed or expired; this does not prove Plex is fixed.
    </p>
    <ul
      v-if="current.items.length"
      class="space-y-3"
    >
      <li
        v-for="item in current.items"
        :key="item.sourceId"
        class="rounded-sm bg-gray-900 p-3"
      >
        <p class="font-semibold">
          {{ item.title }}<span v-if="item.year"> ({{ item.year }})</span>
        </p>
        <p class="text-sm text-gray-300">
          {{ item.mediaType }} · {{ item.library }}
        </p>
        <p class="mt-1 text-sm">
          {{ item.issue }}
        </p>
        <a
          v-if="safePlexLink(item.plexUrl)"
          :href="item.plexUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block mt-2 text-blue-300 underline focus-visible:outline focus-visible:outline-2"
        >Open {{ item.title }} in Plex (new tab)</a>
        <p
          v-else
          class="mt-2 text-sm text-gray-300"
        >
          Plex link is not available yet. It will be checked again on refresh; you can also search Plex by this title.
        </p>
      </li>
    </ul>
    <p
      v-if="current.truncated"
      class="text-sm"
    >
      Showing the first 50 retained items. Later sync reports can expose remaining issues as these are resolved.
    </p>
    <ol class="list-decimal space-y-2 pl-5 text-sm">
      <li
        v-for="step in current.steps"
        :key="step"
      >
        {{ step }}
      </li>
    </ol>
    <p class="text-sm text-gray-300">
      {{ current.recovery }}
    </p>
    <p class="text-sm text-gray-300">
      {{ current.privacy }}
    </p>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <span role="status">{{ paused ? 'Automatic updates paused.' : 'Updates every 30 seconds while this tab is visible.' }}</span>
      <button
        type="button"
        :disabled="isLoading"
        class="rounded-sm px-2 py-1 text-blue-300 underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
        @click="refreshDetails"
      >
        Refresh details now
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import api from '@/api'
import { useSWR } from '@/composables/useSWR'

const props = defineProps({
  errorId: { type: String, required: true },
  remediation: { type: Object, required: true },
})
const paused = ref(false)
const pausedSnapshot = ref(props.remediation)
const { data, error, isLoading, refresh } = useSWR(
  `logs:remediation:${props.errorId}`,
  async () => (await api.getLogError(props.errorId)).remediation ?? props.remediation,
  { initialData: props.remediation, persist: false, pollOnlyWhenVisible: true,
    pollInterval: () => paused.value ? null : 30000 },
)
const current = computed(() => paused.value ? pausedSnapshot.value : data.value ?? props.remediation)
function togglePaused() {
  if (!paused.value) pausedSnapshot.value = current.value
  paused.value = !paused.value
}
async function refreshDetails() {
  await refresh()
  if (paused.value) pausedSnapshot.value = data.value ?? props.remediation
}
function safePlexLink(url) {
  return typeof url === 'string' && /^https:\/\/app\.plex\.tv\/desktop\/#!\/server\/[a-fA-F0-9-]{16,64}\/details\?key=%2Flibrary%2Fmetadata%2F[1-9][0-9]{0,19}$/.test(url)
}
</script>
