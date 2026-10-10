<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section aria-label="Saved source mappings">
    <h4>Saved mappings</h4>
    <p>Approval and completion are separate. Refresh to see committed state, including after a lost response. Revoking removes only this mapping's derived identity; it does not delete source media.</p>
    <button
      type="button"
      :disabled="busy"
      @click="load(0)"
    >
      Refresh saved mappings
    </button>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ notice }}
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <ul v-if="report">
      <li
        v-for="item in report.items"
        :key="item.id"
      >
        <strong>{{ item.title }}</strong> · {{ item.libraryName }}
        <p>{{ labels[item.status] }}</p>
        <p v-if="item.scope.kind === 'whole_work'">
          Whole work: TMDb {{ item.scope.tmdbId }}
        </p>
        <ul v-else>
          <li
            v-for="edge in item.scope.mappings"
            :key="edge.sourceSeason"
          >
            Source season {{ edge.sourceSeason }} → TMDb series {{ edge.tmdbSeriesId }}, season {{ edge.tmdbSeason }}
          </li>
        </ul>
        <p v-if="item.retryAfter">
          Next verification eligible after {{ new Date(item.retryAfter).toLocaleString() }}.
        </p>
        <p class="reference">
          Mapping reference: {{ item.id }}
        </p>
        <template v-if="item.status !== 'revoked'">
          <label><input
            v-model="selected"
            type="checkbox"
            :value="item.id"
            :disabled="busy"
          > Revoke this mapping and restore the unresolved state if its identity is still in use.</label>
          <button
            type="button"
            :disabled="busy || !selected.includes(item.id) || uncertain"
            @click="revoke(item.id)"
          >
            Revoke mapping for {{ item.title }}
          </button>
        </template>
      </li>
    </ul>
    <nav
      v-if="report"
      aria-label="Saved mapping pages"
    >
      <button
        type="button"
        :disabled="busy || !report.offset"
        @click="load(Math.max(0, report.offset - 50))"
      >
        Previous mappings
      </button>
      <button
        type="button"
        :disabled="busy || !report.hasMore"
        @click="load(report.offset + 50)"
      >
        Next mappings
      </button>
    </nav>
  </section>
</template>
<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { getSourceMappings, revokeSourceMapping } from '@/api/mediaIdentityReviewApi'
import { parseSourceMappings, sourceMappingStatusLabels as labels } from '@/utils/sourceMappings'
const report = ref(null), selected = ref([]), busy = ref(false), error = ref(''), notice = ref(''), uncertain = ref(false)
let sequence = 0
onBeforeUnmount(() => { sequence++ })
async function load(offset) {
  if (busy.value) return
  const ticket = ++sequence
  busy.value = true; error.value = ''; selected.value = []
  try {
    const data = parseSourceMappings(await getSourceMappings({ offset }))
    if (ticket !== sequence) return
    if (!data) throw new Error('invalid_response')
    report.value = data; uncertain.value = false
    notice.value = data.items.length ? 'Saved mapping status refreshed.' : 'No saved mappings on this page.'
  } catch {
    if (ticket === sequence) { error.value = 'Saved mappings are unavailable. Refresh to try again.'; report.value = null }
  } finally { if (ticket === sequence) busy.value = false }
}
async function revoke(id) {
  if (busy.value || uncertain.value || !selected.value.includes(id)) return
  const ticket = ++sequence
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const { data } = await revokeSourceMapping(id)
    if (ticket !== sequence) return
    if (data?.version !== 'source_mapping_revocation.v1' || data.mappingId !== id || data.status !== 'revoked') throw new Error('invalid_receipt')
    report.value.items = report.value.items.map(item => item.id === id ? { ...item, status: 'revoked' } : item)
    selected.value = []; notice.value = 'Mapping revoked. Refresh metadata issues to see the current count.'
  } catch {
    if (ticket === sequence) { uncertain.value = true; error.value = 'Revocation could not be confirmed. Refresh saved mappings before submitting again.' }
  } finally { if (ticket === sequence) busy.value = false }
}
</script>
<style scoped>
section { padding: 1rem; margin-top: 1rem; border: 1px solid #64748b; border-radius: .4rem; }
h4 { font-weight: 700; } p, li { margin: .75rem 0; } .reference { overflow-wrap: anywhere; font-size: .875rem; }
label { display: flex; align-items: center; gap: .6rem; min-height: 2.75rem; }
button { min-height: 2.75rem; padding: .5rem .75rem; margin-right: .5rem; border: 1px solid #64748b; border-radius: .4rem; color: #bfdbfe; }
button:disabled { opacity: .5; cursor: not-allowed; }
:is(button, input):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
