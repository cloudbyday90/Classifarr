<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="library-overview"
    aria-labelledby="library-overview-heading"
  >
    <div class="heading-row">
      <div>
        <h2 id="library-overview-heading">
          Your libraries at a glance
        </h2>
        <p class="scope-note">
          Library summaries · metadata · decisions
        </p>
      </div>
      <button
        v-if="displaySummary"
        type="button"
        :aria-pressed="paused"
        @click="togglePause"
      >
        {{ paused ? 'Resume overview' : 'Pause overview' }}
      </button>
    </div>
    <p
      v-if="loading && !displaySummary"
      role="status"
    >
      Checking library status…
    </p>
    <p
      v-else-if="!displaySummary"
      role="status"
    >
      Library status is temporarily unavailable.
    </p>
    <p v-else-if="!displaySummary.libraryCount">
      No libraries connected. <RouterLink to="/libraries">
        Set up libraries
      </RouterLink>
    </p>
    <template v-else>
      <div class="metrics">
        <article class="metric">
          <h3>Library summaries</h3>
          <div class="metric-visual">
            <LibraryFreshnessRing
              :current="displaySummary.profile.current"
              :total="displaySummary.libraryCount"
            />
            <div><strong>{{ displaySummary.profile.current }} of {{ displaySummary.libraryCount }}</strong><p>current</p></div>
          </div>
          <p class="scope-note">
            Freshness, not placement accuracy.
          </p>
          <a
            href="#libraries"
            @click="$emit('open-library-status')"
          >See library status →</a>
        </article>
        <article class="metric">
          <h3>Metadata issues</h3>
          <div class="metric-visual">
            <strong class="metric-number issue-number">{{ displaySummary.sourceIdentity.unresolvedItemCount }}</strong>
            <span>items with<br>unresolved IDs</span>
          </div>
          <p class="scope-note">
            Recovery is checked per item.
          </p>
          <button
            type="button"
            :aria-expanded="issuesOpen"
            aria-controls="overview-source-issues"
            @click="issuesOpen = !issuesOpen"
          >
            {{ issuesOpen ? 'Hide items' : 'See items & recovery →' }}
          </button>
        </article>
        <article class="metric">
          <h3>Decisions waiting</h3>
          <div class="metric-visual">
            <strong class="metric-number decision-number">{{ displayDecisionCount ?? '—' }}</strong>
            <span>{{ displayDecisionCount === null ? 'Status unavailable' : 'pending items' }}</span>
          </div>
          <p class="scope-note">
            Separate from metadata issues.
          </p>
          <a
            v-if="displayDecisionCount !== null"
            href="#needs-attention"
            @click="$emit('open-decisions')"
          >Open pending items →</a>
        </article>
      </div>
      <div class="next-step">
        <div>
          <span class="eyebrow">Suggested next step</span>
          <h3>{{ nextStep.title }}</h3>
          <p class="scope-note">
            {{ nextStep.detail }}
          </p>
        </div>
        <a
          v-if="nextStep.target === 'libraries'"
          href="#libraries"
          @click="$emit('open-library-status')"
        >Check library status →</a>
        <a
          v-else-if="nextStep.target === 'decisions'"
          href="#needs-attention"
          @click="$emit('open-decisions')"
        >Open pending items →</a>
        <button
          v-else-if="nextStep.target === 'issues'"
          type="button"
          :aria-expanded="issuesOpen"
          aria-controls="overview-source-issues"
          @click="issuesOpen = !issuesOpen"
        >
          {{ issuesOpen ? 'Hide items' : 'Check affected items →' }}
        </button>
      </div>
      <p
        v-if="paused"
        class="scope-note"
      >
        Overview paused. Background work and item details are not paused.
      </p>
      <div
        v-show="issuesOpen"
        id="overview-source-issues"
      >
        <SourceIdentityIssuesPanel
          v-if="issuesOpen"
          :expected-count="displaySummary.sourceIdentity.unresolvedItemCount"
        />
      </div>
      <details>
        <summary>Coverage & measurement</summary>
        <p class="scope-note">
          {{ displaySummary.profile.updating }} updating · {{ displaySummary.profile.coolingDown }} cooling down ·
          {{ displaySummary.profile.unverified }} unverified · {{ displaySummary.profile.paused }} inactive ·
          {{ displaySummary.profile.noInventory }} awaiting inventory.
        </p>
        <p class="scope-note">
          Metadata counts cover {{ displaySummary.sourceIdentity.coveredActiveLibraryCount }} of
          {{ displaySummary.sourceIdentity.activeLibraryCount }} active libraries with complete full scans within 30 days.
          Items in other libraries are not assessed here.
        </p>
        <p class="scope-note">
          Placement accuracy: not measured here. No trend history is available in this snapshot.
        </p>
        <p
          v-if="displaySummary.asOf"
          class="scope-note"
        >
          Library snapshot: {{ new Date(displaySummary.asOf).toLocaleString() }}.
        </p>
        <p class="scope-note">
          Viewing this overview does not change routing, trigger AI, or start a backfill.
        </p>
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import LibraryFreshnessRing from './LibraryFreshnessRing.vue'
import SourceIdentityIssuesPanel from './SourceIdentityIssuesPanel.vue'

const props = defineProps({
  summary: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  pendingDecisionCount: { type: Number, default: null },
})
defineEmits(['open-library-status', 'open-decisions'])
const paused = ref(false), displaySummary = ref(null), displayDecisionCount = ref(null), issuesOpen = ref(false)
watch(() => [props.summary, props.pendingDecisionCount], ([summary, count]) => {
  // Permission loss or unavailable data clears even a deliberately paused view.
  if (!summary || !paused.value) displaySummary.value = summary
  if (count === null || !paused.value) displayDecisionCount.value = count
}, { immediate: true })

function togglePause() {
  paused.value = !paused.value
  if (!paused.value) {
    displaySummary.value = props.summary
    displayDecisionCount.value = props.pendingDecisionCount
  }
}

const nextStep = computed(() => {
  const value = displaySummary.value
  if (value?.recovery.overdueLibraryCount) return { title: 'Check delayed library updates',
    detail: `${value.recovery.overdueLibraryCount} ${value.recovery.overdueLibraryCount === 1 ? 'library is' : 'libraries are'} overdue.${value.recovery.workerStalled ? ' The background worker needs a check.' : ''}`, target: 'libraries' }
  if (displayDecisionCount.value > 0) return { title: 'Review the pending decisions',
    detail: 'Open the items and their available recommendations.', target: 'decisions' }
  if (value?.sourceIdentity.unresolvedItemCount) return { title: 'Check the metadata issues',
    detail: 'See which items can retry automatically and which need a source check.', target: 'issues' }
  if (displayDecisionCount.value === null) return { title: 'Wait for decision status', detail: 'The pending-item count is not available yet.' }
  if (value?.profile.current !== value?.libraryCount) return { title: 'Check library update progress', detail: 'Some summaries are not current yet.', target: 'libraries' }
  return { title: 'No action indicated by these checks', detail: 'This does not establish placement accuracy or complete metadata coverage.' }
})
</script>

<style scoped>
.library-overview { margin-bottom: 1.5rem; color: #e5e7eb; }
.heading-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1rem; }
h2, h3 { font-weight: 700; color: #f9fafb; margin: 0; }
h2 { font-size: 1.2rem; } h3 { font-size: 1rem; }
p { margin: .35rem 0 0; line-height: 1.5; }
.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.metric { padding: 1.1rem; background: #1f2937; border: 1px solid #475569; border-radius: .85rem; }
.metric-visual { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; min-height: 8.2rem; overflow-wrap: anywhere; }
.metric-number { font-size: 3.75rem; line-height: 1; letter-spacing: -.04em; }
.issue-number { color: #fcd34d; } .decision-number { color: #93c5fd; }
.scope-note { color: #cbd5e1; font-size: .875rem; }
.metric a, .metric button { margin-top: .75rem; }
.next-step { margin-top: 1rem; border: 1px solid #536b8d; border-left: 4px solid #93c5fd; background: #19273a; border-radius: .65rem; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.eyebrow { display: block; color: #bfdbfe; font-size: .75rem; text-transform: uppercase; letter-spacing: .07em; margin-bottom: .4rem; }
button, a { color: #bfdbfe; min-height: 2.75rem; display: inline-flex; align-items: center; border-radius: .4rem; }
button { border: 1px solid #64748b; padding: .5rem .75rem; }
details { margin-top: .85rem; } summary { cursor: pointer; color: #bfdbfe; width: fit-content; min-height: 2.75rem; padding-top: .65rem; }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
@media (max-width: 1000px) { .metrics { grid-template-columns: 1fr; } .metric-visual { min-height: 7rem; } }
</style>
