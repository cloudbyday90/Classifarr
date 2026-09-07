<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="source-observations-title"
    :aria-busy="loading"
    class="space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-4"
  >
    <h2
      id="source-observations-title"
      class="text-xl font-semibold"
    >
      Unresolved source observations
    </h2>
    <p class="text-sm text-gray-300">
      Items with conflicting or invalid identities are retained separately during library sync.
      These observations describe source membership and do not establish a TMDb identity or classification.
    </p>
    <p role="status">
      {{ loading ? 'Loading source observations…' : report ? 'Source observations loaded.' : '' }}
    </p>
    <div v-if="error">
      <p role="alert">
        Source observations are unavailable. Try again shortly.
      </p>
      <button
        type="button"
        class="mt-2 rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="load"
      >
        Retry source observations
      </button>
    </div>
    <template v-if="report">
      <p class="text-sm text-gray-300">
        Snapshot: {{ report.observedAt }}. Includes {{ report.scope.selectedLibraryCount }} of {{ report.scope.activeLibraryCount }} active libraries
        in library ID order. Retains observations seen within {{ report.scope.retentionDays }} days,
        up to {{ report.scope.retainedPerLibrary }} per library. Examples are limited to {{ report.scope.previewPerLibrary }} per library.
      </p>
      <p v-if="!report.libraries.length">
        No active libraries are available.
      </p>
      <div
        v-for="library in report.libraries"
        :key="library.id"
        class="space-y-2 border-t border-gray-700 pt-3"
      >
        <h3 class="font-semibold">
          {{ library.name }} (#{{ library.id }})
        </h3>
        <p>{{ statusLabel(library.status) }} Retained observations: {{ library.retainedCount ?? 'withheld' }}.</p>
        <p
          v-if="library.capture"
          class="text-sm text-gray-300"
        >
          Latest capture started {{ library.capture.startedAt }}. Source items seen: {{ library.capture.observedCount }};
          rejected identities: {{ library.capture.rejectedCount }}; items without usable source keys: {{ library.capture.uncapturableCount }};
          observations omitted at capacity: {{ library.capture.omittedCount }}.
        </p>
        <div
          v-if="library.examples.length"
          role="region"
          :aria-label="`Unresolved observations in ${library.name}`"
          tabindex="0"
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[40rem] text-left text-sm">
            <caption class="pb-2 text-left">
              Recent unresolved source items
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  Title / year
                </th><th scope="col">
                  Source type
                </th><th scope="col">
                  Identity issue
                </th><th scope="col">
                  Last observed
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in library.examples"
                :key="item.sourceFingerprint"
              >
                <th
                  scope="row"
                  class="break-words"
                >
                  {{ item.title || 'Title not supplied' }} / {{ item.year || 'unknown' }}
                </th>
                <td>{{ item.mediaType || 'unknown' }}</td>
                <td>{{ issueLabel(item.identityIssue) }}<span v-if="item.providerFields.length"> ({{ item.providerFields.map(providerLabel).join(', ') }})</span></td>
                <td>{{ item.lastSeenAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { getLibrarySourceObservations } from '@/api/libraryCatalogApi'
const report = ref(null), loading = ref(true), error = ref(false)
let active = true
const statusLabel = value => ({ not_captured: 'No capture recorded; coverage is unknown.', collecting: 'Capture in progress; evidence is partial.',
  failed: 'Latest capture failed; retained observations may be older.', partial: 'Partial capture; absence is not established.',
  complete: 'Full capture completed.', expired: 'Capture is older than retention; current coverage is unknown.',
  capacity_exceeded: 'Storage capacity exceeded; counts are withheld.' })[value] || 'Capture state unknown.'
const issueLabel = value => ({ conflicting_provider_ids: 'Conflicting provider IDs', invalid_provider_ids: 'Invalid provider IDs',
  invalid_media_type: 'Unknown media type' })[value] || 'Unresolved identity'
const providerLabel = value => ({ tmdb_id: 'TMDb', imdb_id: 'IMDb', tvdb_id: 'TVDB' })[value] || 'Unknown provider'
async function load() {
  loading.value = true; error.value = false; report.value = null
  try { const result = await getLibrarySourceObservations(); if (active) report.value = result }
  catch { if (active) error.value = true }
  finally { if (active) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { active = false })
</script>

<style scoped>
th, td { padding: 0.5rem 0.75rem; vertical-align: top; }
</style>
