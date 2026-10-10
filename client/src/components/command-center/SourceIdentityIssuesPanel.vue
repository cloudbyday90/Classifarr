<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="source-issues-heading"
    class="issue-panel"
  >
    <div class="panel-heading">
      <h3
        id="source-issues-heading"
        ref="heading"
        tabindex="-1"
      >
        Metadata issues
      </h3>
      <button
        type="button"
        :disabled="isStale"
        @click="refresh"
      >
        Refresh items
      </button>
    </div>
    <p
      v-if="error"
      role="alert"
    >
      Metadata issues are unavailable. Refresh to try again.
    </p>
    <p
      v-else-if="!report"
      role="status"
    >
      Loading the matching items…
    </p>
    <template v-else>
      <p role="status">
        {{ report.total }} items · {{ isStale ? 'Refreshing…' : 'Latest check: ' + formatDate(report.asOf) }}
      </p>
      <p v-if="report.total">
        Posters and descriptions can be present even when catalog IDs conflict or are invalid.
        These are identity checks, not a count of items without metadata.
      </p>
      <p
        v-if="report.total !== expectedCount"
        class="scope-note"
      >
        The overview showed {{ expectedCount }}. The count has changed since that check.
      </p>
      <div
        v-if="report.total"
        class="recovery-bar"
        aria-hidden="true"
      >
        <span
          v-for="(label, state) in recoveryLabels"
          :key="state"
          :class="state"
          :style="{ width: `${report.recovery[state] / report.total * 100}%` }"
        />
      </div>
      <ul
        class="legend"
        aria-label="Recovery breakdown"
      >
        <li
          v-for="(label, state) in recoveryLabels"
          :key="state"
        >
          <strong>{{ report.recovery[state] }}</strong> {{ label }}
        </li>
      </ul>
      <p class="scope-note">
        {{ report.coveredLibraryCount }} of {{ report.activeLibraryCount }} active libraries have complete full scans
        within 30 days. Other libraries are not assessed here. Retry times are eligibility times, not appointments.
      </p>
      <p v-if="!report.total">
        No metadata issues in the assessed libraries.
      </p>
      <p v-else-if="!report.items.length">
        This page is now empty. Return to the first page.
      </p>
      <ol
        class="issue-list"
        :start="offset + 1"
      >
        <li
          v-for="item in report.items"
          :key="item.key"
        >
          <div class="item-heading">
            <h4>{{ item.title || 'Title not supplied' }} <span v-if="item.year">({{ item.year }})</span></h4>
            <span class="state-label">{{ recoveryLabels[item.recoveryState] }}</span>
          </div>
          <p class="scope-note">
            {{ item.libraryName || 'Library' }} · {{ item.mediaType === 'movie' ? 'Movie' : item.mediaType === 'tv' ? 'TV' : 'Unknown type' }}
          </p>
          <p>{{ sourceIssueExplanation(item) }}</p>
          <p><strong>{{ recoveryOutcomeLabel(item.lastRecovery) }}</strong></p>
          <p
            v-if="item.lastRecovery"
            class="scope-note"
          >
            {{ item.lastRecovery.completedAt ? 'Result recorded: ' + formatDate(item.lastRecovery.completedAt)
              : 'Attempt recorded: ' + formatDate(item.lastRecovery.attemptedAt) }}
          </p>
          <p>{{ sourceIssueNextStep(item) }}</p>
          <p
            v-if="item.retryAfter"
            class="scope-note"
          >
            Retry eligible after {{ formatDate(item.retryAfter) }}.
          </p>
          <RouterLink :to="`/libraries/${item.libraryId}`">
            Open library
          </RouterLink>
          <SourceScopeDraft
            v-if="item.sourceVersion && item.issue === 'conflicting_provider_ids' && ['movie', 'tv'].includes(item.mediaType)"
            :key="item.key + item.sourceVersion"
            :source="item"
            :offset="offset"
          />
        </li>
      </ol>
      <nav
        aria-label="Metadata issue pages"
        class="page-controls"
      >
        <button
          v-if="offset"
          type="button"
          @click="offset = 0"
        >
          First page
        </button>
        <button
          type="button"
          :disabled="!offset || isStale"
          @click="offset = Math.max(0, offset - report.pageSize)"
        >
          Previous
        </button>
        <span>{{ report.items.length ? offset + 1 : 0 }}–{{ report.items.length ? offset + report.items.length : 0 }} of {{ report.total }}</span>
        <button
          type="button"
          :disabled="offset + report.pageSize >= report.total || isStale"
          @click="offset += report.pageSize"
        >
          Next
        </button>
      </nav>
    </template>
    <SourceMappingsPanel />
  </section>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useSourceIdentityIssues } from '@/composables/useSourceIdentityIssues'
import { recoveryLabels, sourceIssueExplanation, sourceIssueNextStep } from '@/utils/sourceIdentityIssues'
import { recoveryOutcomeLabel } from '@/utils/sourceRecoveryOutcomes'
import SourceScopeDraft from '@/components/library/SourceScopeDraft.vue'
import SourceMappingsPanel from '@/components/library/SourceMappingsPanel.vue'
defineProps({ expectedCount: { type: Number, required: true } })
const { report, offset, error, refresh, isStale } = useSourceIdentityIssues()
const heading = ref(null)
let displayedOffset = 0
watch(report, async value => {
  if (!value || value.offset === displayedOffset) return
  displayedOffset = value.offset
  await nextTick()
  heading.value?.focus()
})
const formatDate = value => new Date(value).toLocaleString()
</script>

<style scoped>
.issue-panel { margin-top: 1rem; border-top: 1px solid #475569; padding-top: 1rem; }
.panel-heading, .item-heading, .page-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
h3, h4 { font-weight: 700; margin: 0; }
p { margin: .5rem 0; }
.scope-note { color: #cbd5e1; font-size: .875rem; }
.recovery-bar { display: flex; height: .7rem; overflow: hidden; border-radius: 1rem; margin: 1rem 0; background: #475569; }
.retry_wait { background: #93c5fd; } .retry_due { background: #6ee7b7; }
.source_review { background: #fcd34d; } .not_recorded { background: #cbd5e1; }
.legend { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; font-size: .875rem; }
.issue-list { list-style: decimal; padding-left: 1.5rem; }
.issue-list li { padding: 1rem 0; border-bottom: 1px solid #475569; overflow-wrap: anywhere; }
.state-label { color: #bfdbfe; font-size: .875rem; }
.page-controls { margin-top: 1rem; justify-content: flex-start; }
button, a { color: #bfdbfe; min-height: 2.75rem; padding: .5rem .75rem; border: 1px solid #64748b; border-radius: .4rem; display: inline-flex; align-items: center; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, a:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
