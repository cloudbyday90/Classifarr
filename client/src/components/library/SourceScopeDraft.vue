<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    class="scope-draft"
    @toggle="onToggle"
  >
    <summary>Draft a catalog mapping (admin)</summary>
    <p :id="`${id}-help`">
      Keep this source item grouped as it is. First check the draft, then verify the
      source and catalog evidence. Saving a complete mapping requires a separate confirmation.
    </p>
    <form
      :aria-describedby="`${id}-help`"
      @submit.prevent="submit"
      @input="clear"
      @change="clear"
    >
      <label :for="`${id}-kind`">Proposed scope</label>
      <select
        :id="`${id}-kind`"
        v-model="kind"
      >
        <option value="whole_work">
          One whole {{ source.mediaType === 'tv' ? 'series' : 'movie' }}
        </option>
        <option
          v-if="source.mediaType === 'tv'"
          value="seasons"
        >
          Explicit season mappings
        </option>
      </select>
      <template v-if="kind === 'whole_work'">
        <label :for="`${id}-target`">TMDb {{ source.mediaType === 'tv' ? 'series' : 'movie' }} ID</label>
        <input
          :id="`${id}-target`"
          v-model="target"
          type="number"
          min="1"
          max="2147483647"
          step="1"
          required
        >
      </template>
      <template v-else>
        <label :for="`${id}-seasons`">Source seasons in this draft (comma-separated, including unmapped seasons)</label>
        <input
          :id="`${id}-seasons`"
          v-model="seasons"
          maxlength="1536"
          pattern="[0-9 ,]+"
          required
          placeholder="0, 1, 2"
        >
        <fieldset
          v-for="(edge, index) in edges"
          :key="edge.key"
        >
          <legend>Mapping {{ index + 1 }}</legend>
          <label :for="`${id}-source-${edge.key}`">Source season</label>
          <input
            :id="`${id}-source-${edge.key}`"
            v-model="edge.sourceSeason"
            type="number"
            min="0"
            max="10000"
            step="1"
            required
          >
          <label :for="`${id}-series-${edge.key}`">TMDb series ID</label>
          <input
            :id="`${id}-series-${edge.key}`"
            v-model="edge.tmdbSeriesId"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            required
          >
          <label :for="`${id}-season-${edge.key}`">TMDb season</label>
          <input
            :id="`${id}-season-${edge.key}`"
            v-model="edge.tmdbSeason"
            type="number"
            min="0"
            max="10000"
            step="1"
            required
          >
          <button
            type="button"
            :disabled="edges.length === 1"
            :aria-label="`Remove mapping ${index + 1}`"
            @click="remove(index)"
          >
            Remove
          </button>
        </fieldset>
        <button
          ref="addButton"
          type="button"
          :disabled="edges.length >= 32"
          @click="add"
        >
          Add season mapping
        </button>
        <p>Up to 32 mappings in this form. Listed seasons without a mapping remain outside the proposed scope.</p>
      </template>
      <button
        type="submit"
        :disabled="busy"
      >
        {{ busy ? 'Checking draft…' : 'Check draft structure' }}
      </button>
    </form>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div
      role="status"
      aria-live="polite"
    >
      <template v-if="result">
        <p>Draft structure is valid. This structure check did not save or approve a mapping.</p>
        <p v-if="result.scope.kind === 'seasons'">
          {{ result.scope.mappings.length }} of {{ result.scope.sourceSeasonNumbers.length }} declared source seasons mapped in this proposal.
        </p>
        <p>Draft checks alone do not resolve the identity conflict. Approval and a successful library sync are required before mapping-backed backfill.</p>
        <p class="reference">
          Draft reference: {{ result.draftFingerprint }}
        </p>
      </template>
    </div>
    <SourceScopeEvidence
      v-if="result"
      :draft="result"
      :offset="offset"
    />
  </details>
</template>

<script setup>
import { nextTick, ref, useId, watch } from 'vue'
import { useSourceScopeReview } from '@/composables/useSourceScopeReview'
import SourceScopeEvidence from './SourceScopeEvidence.vue'
const props = defineProps({ source: { type: Object, required: true }, offset: { type: Number, required: true } })
const id = useId()
const kind = ref('whole_work'), target = ref(''), seasons = ref('')
let nextKey = 0
const newEdge = () => ({ key: nextKey++, sourceSeason: '', tmdbSeriesId: '', tmdbSeason: '' })
const edges = ref([newEdge()])
const addButton = ref(null)
const { result, error, busy, clear, review } = useSourceScopeReview(() => props.source, () => props.offset)
watch(() => props.source.key, () => { kind.value = 'whole_work'; target.value = ''; seasons.value = ''; edges.value = [newEdge()] })
function add() { if (edges.value.length < 32) edges.value.push(newEdge()); clear() }
async function remove(index) {
  edges.value.splice(index, 1); clear()
  await nextTick()
  addButton.value?.focus()
}
function onToggle(event) { if (!event.target.open) clear() }
function submit() {
  const sourceSeasonNumbers = seasons.value.split(',').map(value => value.trim() === '' ? NaN : Number(value))
  const mappings = edges.value.map(({ sourceSeason, tmdbSeriesId, tmdbSeason }) => ({
    sourceSeason: sourceSeason === '' ? NaN : Number(sourceSeason),
    tmdbSeriesId: Number(tmdbSeriesId), tmdbSeason: tmdbSeason === '' ? NaN : Number(tmdbSeason),
  }))
  void review(kind.value === 'whole_work' ? { kind: 'whole_work', tmdbId: Number(target.value) }
    : { kind: 'seasons', coverage: mappings.length === sourceSeasonNumbers.length ? 'complete' : 'partial', sourceSeasonNumbers, mappings })
}
</script>

<style scoped>
.scope-draft { margin-top: .75rem; padding: .75rem; border: 1px solid #64748b; border-radius: .4rem; }
summary { cursor: pointer; min-height: 2.75rem; padding: .5rem; color: #bfdbfe; }
p { margin: .75rem 0; }
label { display: block; margin-top: .75rem; }
input, select, button { border: 1px solid #64748b; border-radius: .35rem; padding: .5rem; min-height: 2.75rem; max-width: 100%; background: #1e293b; color: #f1f5f9; }
button { margin: .75rem .5rem 0 0; }
button:disabled { opacity: .5; cursor: not-allowed; }
fieldset { padding: .75rem; margin-top: .75rem; border: 1px solid #475569; }
:is(summary, input, select, button):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.reference { overflow-wrap: anywhere; font-size: .875rem; color: #cbd5e1; }
</style>
