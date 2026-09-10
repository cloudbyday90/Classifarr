<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="source-repair-worklist-title"
    :aria-busy="loading"
    class="space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-4"
  >
    <h2
      id="source-repair-worklist-title"
      class="text-xl font-semibold"
    >
      Source repair worklist
    </h2>
    <p class="text-sm text-gray-300">
      Correct the source item’s match in the media server, then run a full library sync. Classifarr does not choose an ID,
      change the source, or route these items.
    </p>
    <p role="status">
      {{ loading ? 'Loading source repair worklist…' : report ? 'Source repair worklist loaded.' : '' }}
    </p>
    <div v-if="error">
      <p role="alert">
        The source repair worklist is unavailable. Try again shortly.
      </p>
      <button
        type="button"
        class="mt-2 rounded border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="load"
      >
        Retry source repair worklist
      </button>
    </div>
    <template v-if="report">
      <p class="text-sm text-gray-300">
        Snapshot: {{ report.observedAt }}. It selects at most {{ report.scope.maximumEntries }} current conflicts,
        with at most {{ report.scope.maximumEntriesPerLibrary }} per library. It includes {{ report.scope.selectedLibraryCount }} of
        {{ report.scope.activeLibraryCount }} active libraries in a daily rotating library-ID window, from complete full captures in the last
        {{ report.scope.retentionDays }} days.
      </p>
      <p v-if="report.status.id === 'no_current_conflicts'">
        No current complete-capture source conflicts need repair in this worklist window.
      </p>
      <div
        v-else
        role="region"
        aria-label="Source repair worklist"
        tabindex="0"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[44rem] text-left text-sm">
          <caption class="pb-2 text-left">
            {{ report.scope.selectedEntryCount }} source conflicts selected
          </caption>
          <thead>
            <tr>
              <th scope="col">
                Library
              </th><th scope="col">
                Media
              </th><th scope="col">
                Conflict
              </th><th scope="col">
                Next source action
              </th><th scope="col">
                Last observed
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in report.entries"
              :key="entry.sourceFingerprint"
            >
              <th scope="row">
                {{ entry.library.name }}
              </th>
              <td class="break-words">
                {{ entry.title || 'Title not supplied' }} / {{ entry.year || 'unknown' }} ({{ entry.mediaType || 'unknown' }})
              </td>
              <td>{{ issueLabel(entry.identityIssue) }}<span v-if="entry.providerFields.length"> ({{ entry.providerFields.map(providerLabel).join(', ') }})</span></td>
              <td>{{ actionLabel(entry.repairActionId) }}</td>
              <td>{{ entry.lastSeenAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getLibrarySourceRepairWorklist } from '@/api/libraryCatalogApi'

const report = ref(null)
const loading = ref(true)
const error = ref(false)
let active = true

const issueLabel = value => ({ conflicting_provider_ids: 'Conflicting provider IDs' })[value] || 'Unresolved identity'
const providerLabel = value => ({ tmdb_id: 'TMDb', imdb_id: 'IMDb', tvdb_id: 'TVDB' })[value] || 'Unknown provider'
const actionLabel = value => ({ correct_source_match_then_resync: 'Correct the source match, then run a full sync.' })[value] || 'Repair at the source, then run a full sync.'

async function load() {
  loading.value = true
  error.value = false
  report.value = null
  try {
    const result = await getLibrarySourceRepairWorklist()
    if (active) report.value = result
  } catch {
    if (active) error.value = true
  } finally {
    if (active) loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => { active = false })
</script>

<style scoped>
th, td { padding: 0.5rem 0.75rem; vertical-align: top; }
</style>
