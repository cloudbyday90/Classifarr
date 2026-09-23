<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    v-if="report || loading || errorMessage"
    class="profile-refresh"
    aria-labelledby="profile-refresh-heading"
  >
    <h3 id="profile-refresh-heading">
      Library status
    </h3>
    <p
      v-if="loading && !report"
      role="status"
      class="profile-refresh-note"
    >
      Checking automatic profile refresh…
    </p>
    <p
      v-else-if="errorMessage"
      role="status"
      class="profile-refresh-note"
    >
      {{ errorMessage }}
    </p>
    <template v-else-if="report">
      <div role="status">
        <p class="profile-refresh-note">
          {{ readiness ? readinessText : summaryText }}
        </p>
        <p
          v-if="readiness"
          class="profile-refresh-note"
        >
          {{ sourceText }}
        </p>
        <p
          v-if="readiness && !readiness.upgradeEnrollmentRecorded && readiness.libraryCount"
          class="profile-refresh-note"
        >
          Upgrade enrollment has not been recorded on this installation; this is a read-only assessment.
        </p>
      </div>
      <details v-if="report.libraries.length">
        <summary>Show per-library status{{ report.windowTruncated ? ' (first 200)' : '' }}</summary>
        <ul>
          <li
            v-for="library in report.libraries"
            :key="library.libraryId"
          >
            <span>{{ library.name }}</span>
            <span>{{ labels[library.statusId] }}</span>
          </li>
        </ul>
      </details>
      <p
        v-if="report.windowTruncated"
        class="profile-refresh-note"
      >
        Showing the first 200 libraries, prioritizing pending work. This is not a complete count.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { LIBRARY_PROFILE_REFRESH_STATUS_LABELS as labels } from '@/utils/libraryProfileRefreshStatus'

const props = defineProps({
  report: { type: Object, default: null },
  readiness: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
})

const readinessText = computed(() => {
  const snapshot = props.readiness
  if (!snapshot) return ''
  const p = snapshot.profile
  const updating = p.queued + p.processing + p.retryWait + p.waiting
  const attention = p.cooldown + p.unverified
  return `${snapshot.libraryCount} libraries: ${p.current} current, ${updating} updating, ` +
    `${attention} need recovery, ${p.paused} paused, ${p.noInventory} not synced.`
})

const sourceText = computed(() => {
  const snapshot = props.readiness
  if (!snapshot) return ''
  const observed = snapshot.sourceIdentity
  if (snapshot.activeLibraryCount === 0) return 'No active libraries have source-identity coverage to assess.'
  return `Source identity: ${observed.unresolvedItemCount} unresolved items observed; ` +
    `recent complete captures cover ${observed.completeCaptureLibraryCount} of ` +
    `${snapshot.activeLibraryCount} active libraries.`
})

const summaryText = computed(() => {
  const counts = props.report?.summary || {}
  const current = counts.current || 0
  const updating = (counts.queued || 0) + (counts.processing || 0) +
    (counts.retry_wait || 0) + (counts.waiting || 0)
  const recovery = (counts.cooldown || 0) + (counts.unverified || 0)
  const paused = counts.paused || 0
  const notSynced = counts.no_inventory || 0
  if (current === 0 && updating === 0 && recovery === 0 && paused === 0) {
    return 'No library profiles have synced inventory yet.'
  }
  if (updating === 0 && recovery === 0 && paused === 0 && notSynced === 0) {
    return `${current} library ${current === 1 ? 'profile is' : 'profiles are'} current.`
  }
  const parts = [`${current} current`, `${updating} awaiting or running refresh`]
  if (recovery) parts.push(`${recovery} awaiting verification or recovery`)
  if (paused) parts.push(`${paused} paused while inactive`)
  if (notSynced) parts.push(`${notSynced} without synced inventory`)
  return `${parts.join(' · ')}.`
})
</script>

<style scoped>
.profile-refresh {
  border: 1px solid #374151;
  border-radius: 0.375rem;
  background: #111827;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.75rem;
}

h3 {
  color: #e5e7eb;
  font-size: 0.8125rem;
  font-weight: 600;
}

.profile-refresh-note {
  color: #9ca3af;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

summary {
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.75rem;
  margin-top: 0.375rem;
  width: fit-content;
}

summary:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}

li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: 0.375rem 0;
  border-top: 1px solid #374151;
  color: #d1d5db;
  font-size: 0.75rem;
}

li span:last-child {
  color: #9ca3af;
}
</style>
