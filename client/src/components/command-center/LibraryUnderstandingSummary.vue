<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="understanding-summary"
    aria-labelledby="understanding-heading"
  >
    <div class="heading-row">
      <h2 id="understanding-heading">
        Library understanding
      </h2>
      <span
        v-if="displaySummary && displaySummary.libraryCount"
        class="status-label"
      >{{ statusLabel }}</span>
      <button
        v-if="displaySummary"
        type="button"
        :aria-pressed="paused"
        @click="togglePause"
      >
        {{ paused ? 'Resume updates' : 'Pause updates' }}
      </button>
    </div>
    <p
      v-if="loading && !displaySummary"
      role="status"
    >
      Checking library profiles…
    </p>
    <p
      v-else-if="!displaySummary"
      role="status"
    >
      Library profile status is temporarily unavailable.
    </p>
    <template v-else-if="!displaySummary.libraryCount">
      <p>
        No libraries are connected yet. <RouterLink to="/libraries">
          Set up libraries
        </RouterLink> to begin discovery.
      </p>
    </template>
    <template v-else>
      <p role="status">
        {{ displaySummary.profile.current }} of {{ displaySummary.libraryCount }} inventory-derived library profiles are current.
        <span v-if="displaySummary.profile.updating">{{ displaySummary.profile.updating }} {{ displaySummary.profile.updating === 1 ? 'is' : 'are' }} updating automatically.</span>
        <span v-if="displaySummary.profile.noInventory">{{ displaySummary.profile.noInventory }} {{ displaySummary.profile.noInventory === 1 ? 'awaits' : 'await' }} inventory sync.</span>
      </p>
      <p
        v-if="displaySummary.recovery.overdueLibraryCount"
        class="attention-note"
      >
        {{ displaySummary.recovery.overdueLibraryCount }} {{ displaySummary.recovery.overdueLibraryCount === 1 ? 'library is' : 'libraries are' }} overdue for automatic recovery.
        {{ displaySummary.recovery.workerStalled ? 'The background worker also needs a check.' : 'Classifarr will keep retrying.' }}
        <a
          href="#libraries"
          @click="$emit('open-library-status')"
        >See library status</a>.
      </p>
      <p
        v-if="displaySummary.sourceIdentity.unresolvedItemCount"
        class="attention-note"
      >
        {{ displaySummary.sourceIdentity.unresolvedItemCount }} source {{ displaySummary.sourceIdentity.unresolvedItemCount === 1 ? 'item has' : 'items have' }} unresolved IDs in recent complete captures.
        <RouterLink to="/libraries/identity-review">
          Review media IDs
        </RouterLink>.
      </p>
      <p class="scope-note">
        {{ paused ? 'Display paused. ' : '' }}
        Profile freshness is not placement accuracy. Description and comparison quality have not been measured here.
      </p>
      <details>
        <summary>Coverage and limits</summary>
        <p>
          {{ displaySummary.profile.coolingDown }} profiles are in automatic cooldown;
          {{ displaySummary.profile.unverified }} await verification;
          {{ displaySummary.profile.paused }} are paused while inactive.
        </p>
        <p>
          Source-ID counts cover {{ displaySummary.sourceIdentity.coveredActiveLibraryCount }} of
          {{ displaySummary.sourceIdentity.activeLibraryCount }} active libraries with recent complete full captures.
          Zero unresolved IDs outside that scope is not established.
        </p>
        <p>This read-only view does not change routing, trigger AI, or start a backfill.</p>
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  summary: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})
defineEmits(['open-library-status'])

const paused = ref(false)
const displaySummary = ref(null)
watch(() => props.summary, (value) => {
  // A lost or invalid snapshot must never remain visible just because updates were paused.
  if (!value || !paused.value) displaySummary.value = value
}, { immediate: true })

function togglePause() {
  paused.value = !paused.value
  if (!paused.value) displaySummary.value = props.summary
}

const statusLabel = computed(() => {
  const value = displaySummary.value
  if (!value) return ''
  if (value.recovery.overdueLibraryCount || value.sourceIdentity.unresolvedItemCount) return 'Needs review'
  if (value.profile.updating || value.profile.coolingDown || value.profile.unverified) return 'Updating'
  if (value.profile.current === value.libraryCount) return 'Profiles current'
  return 'Awaiting inventory'
})
</script>

<style scoped>
.understanding-summary { margin-bottom: 1.5rem; padding: 1rem 1.25rem; border: 1px solid #374151; border-radius: 0.75rem; background: #1f2937; color: #e5e7eb; }
.heading-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
h2 { margin: 0; color: #f9fafb; font-size: 1rem; font-weight: 700; }
p { margin: 0.5rem 0 0; line-height: 1.5; }
.status-label { color: #bfdbfe; font-size: 0.875rem; }
button { color: #bfdbfe; border: 1px solid #64748b; border-radius: 0.375rem; padding: 0.25rem 0.5rem; min-height: 2rem; }
.attention-note { color: #fcd34d; }
.scope-note { color: #cbd5e1; font-size: 0.875rem; }
a, summary { color: #bfdbfe; }
summary { cursor: pointer; margin-top: 0.75rem; width: fit-content; }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
