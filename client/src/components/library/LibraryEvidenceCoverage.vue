<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="available"
    class="rounded-lg border border-gray-700 bg-gray-800 p-4 text-gray-100"
    aria-labelledby="evidence-coverage-heading"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2
        id="evidence-coverage-heading"
        class="text-lg font-semibold"
      >
        Library evidence coverage
      </h2>
      <button
        type="button"
        class="rounded border border-gray-500 px-3 py-1 text-sm text-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        :disabled="loading"
        @click="load"
      >
        Refresh status
      </button>
    </div>
    <p
      v-if="loading && !report"
      role="status"
      class="mt-2 text-sm"
    >
      Checking saved library evidence…
    </p>
    <p
      v-else-if="errorMessage"
      role="status"
      class="mt-2 text-sm text-yellow-200"
    >
      {{ errorMessage }}
    </p>
    <template v-else-if="report">
      <div
        role="status"
        class="mt-2"
      >
        <p>{{ headline }}</p>
        <p
          v-if="report.sourceEvidence?.statusId === 'measured'"
          class="mt-2 text-sm text-gray-200"
        >
          {{ report.sourceEvidence.describedItemCount }} of {{ report.sourceEvidence.eligibleItemCount }} source-anchored items have a local metadata description.
          <span v-if="report.sourceEvidence.describedWithoutTmdbItemCount">
            {{ sourceWithoutTmdbText }}
          </span>
        </p>
        <p
          v-else-if="report.sourceEvidence?.statusId === 'window_truncated'"
          class="mt-2 text-sm text-gray-300"
        >
          Source-level evidence exceeds the 10,000-item diagnostic window and is not estimated.
        </p>
      </div>
      <template v-if="report.statusId === 'measured'">
        <p class="mt-2 text-sm text-gray-200">
          {{ report.description.usableIdentityCount }} of {{ report.description.candidateIdentityCount }} eligible TMDB-linked movie/TV identities have a usable description.
          {{ retrievalText }}
        </p>
        <details class="mt-3 text-sm">
          <summary class="w-fit cursor-pointer text-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            Gaps and measurement limits
          </summary>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li v-if="report.sourceEvidence?.statusId === 'measured'">
              {{ report.sourceEvidence.conflictBlockedItemCount }} source-anchored items are blocked by unresolved identity conflicts;
              {{ report.sourceEvidence.typeMatchedItemCount - report.sourceEvidence.anchoredItemCount }} lack a valid source anchor.
            </li>
            <li v-if="report.sourceEvidence?.statusId === 'measured'">
              {{ report.sourceEvidence.alternateProviderObservedItemCount }} eligible source items have an IMDb or TVDB observation; this does not join items across libraries.
            </li>
            <li>{{ report.source.excluded.missingIdentity }} source items lack a usable TMDB identity.</li>
            <li>{{ report.source.excluded.typeMismatch }} source items differ from this library's media type.</li>
            <li>
              {{ report.source.excluded.sourceConflict }} source items have an unresolved identity conflict.
              <RouterLink
                v-if="report.source.excluded.sourceConflict"
                to="/libraries/identity-review"
                class="text-blue-200 underline"
              >
                Review media IDs →
              </RouterLink>
            </li>
            <li>{{ report.description.missingIdentityCount }} distinct identities lack a description.</li>
            <li>{{ report.description.conflictingIdentityCount }} distinct identities have conflicting descriptions.</li>
            <li v-if="report.retrieval.statusId === 'recently_verified'">
              {{ report.retrieval.retryDeferredIdentityCount }} identities await a scheduled retry;
              {{ report.retrieval.retryDueIdentityCount }} retries are due.
            </li>
          </ul>
          <p class="mt-2">
            These cache and retry counts cover TMDB-linked identities only, not the full source-description corpus.
            Descriptions are grouped by identity, so source-item and identity counts have different denominators.
            The cache is a retrieval checkpoint, not a placement test. Classification quality remains unmeasured.
          </p>
        </details>
      </template>
      <p class="mt-2 text-sm text-gray-300">
        This is a read-only snapshot at inventory revision {{ report.inventoryRevision ?? 'unknown' }}.
        Existing workers continue safe backfill and retry; this view does not start work or change routing.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '@/api'
import { parseLibraryEvidenceCoverage } from '@/utils/libraryEvidenceCoverage'

const props = defineProps({ libraryId: { type: [Number, String], required: true } })
const report = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const available = ref(true)
let requestId = 0

async function load() {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const parsed = parseLibraryEvidenceCoverage(await api.getLibraryEvidenceCoverage(props.libraryId), props.libraryId)
    if (!parsed) throw new TypeError('Invalid evidence coverage response')
    if (currentRequest !== requestId) return
    report.value = parsed
    errorMessage.value = ''
  } catch (error) {
    if (currentRequest !== requestId) return
    report.value = null
    if (Number(error?.response?.status) === 403) available.value = false
    else errorMessage.value = 'Evidence coverage is unavailable. Try again later.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(() => props.libraryId, () => { report.value = null; void load() }, { immediate: true })
onBeforeUnmount(() => { requestId++ })

const headline = computed(() => {
  switch (report.value?.statusId) {
    case 'inactive': return 'This library is inactive; evidence coverage is not evaluated.'
    case 'unsupported_type': return 'Description retrieval coverage is not yet measured for this media type.'
    case 'no_inventory': return 'No synced inventory is available for this library yet.'
    case 'window_truncated': return 'This library has more than 10,000 synced source items. Coverage is not estimated from a partial window.'
    default: return `${report.value?.source.itemCount ?? 0} synced source items; ${report.value?.source.candidateRowCount ?? 0} rows are eligible for TMDB-linked description assessment.`
  }
})

const retrievalText = computed(() => {
  const value = report.value?.retrieval
  if (!value) return ''
  switch (value.statusId) {
    case 'disabled': return 'Description-vector backfill is disabled with RAG.'
    case 'unsupported_provider': return 'No supported local embedding provider is configured.'
    case 'model_unverified': return 'The local model has not been verified recently; current cache coverage is unknown.'
    default: return `${value.indexedIdentityCount} of ${value.eligibleIdentityCount} usable identities have a cached vector for the model inspected within the last ten minutes.`
  }
})

const sourceWithoutTmdbText = computed(() => {
  const count = report.value?.sourceEvidence?.describedWithoutTmdbItemCount ?? 0
  return `${count} described source item${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} no TMDB ID. Eligible movie/TV descriptions can still support background learning; their cache coverage is not measured here.`
})
</script>
