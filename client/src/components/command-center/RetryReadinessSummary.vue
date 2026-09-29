<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="!forbidden"
    class="retry-readiness"
    :aria-labelledby="headingId"
  >
    <header>
      <div>
        <h2 :id="headingId">
          {{ isOmdb ? 'OMDb retries' : 'Web-search retries' }}
        </h2>
        <p
          class="state"
          role="status"
        >
          {{ statusText }}
        </p>
      </div>
      <button
        type="button"
        :aria-pressed="paused"
        @click="togglePaused"
      >
        {{ paused ? 'Resume updates' : 'Pause updates' }}
      </button>
    </header>
    <p
      v-if="unavailable || stale"
      class="message"
    >
      Current readiness cannot be confirmed. {{ paused ? 'Resume updates to check again.' : 'The next status check will try again.' }}
    </p>
    <template v-else-if="report">
      <div
        v-if="report.inspected"
        class="overview"
      >
        <p class="ready-count">
          <strong>{{ ready }}</strong><span>of {{ report.inspected }} checked ready</span>
        </p>
        <div class="chart">
          <div
            class="stacked-bar"
            aria-hidden="true"
          >
            <span
              v-for="segment in chartSegments"
              :key="segment.id"
              :style="{ width: `${segment.percent}%`, background: segment.color }"
            />
          </div>
          <dl
            aria-label="Readiness counts"
            class="legend"
          >
            <div
              v-for="segment in segments"
              :key="segment.id"
            >
              <dt>
                <span
                  class="swatch"
                  aria-hidden="true"
                  :style="{ background: segment.color }"
                />{{ segment.label }}
              </dt>
              <dd>{{ segment.count }}</dd>
            </div>
          </dl>
        </div>
      </div>
      <p
        v-if="isOmdb && report.quota.used !== null"
        class="quota"
      >
        Local daily usage: {{ report.quota.used }} of {{ report.quota.limit }} requests.
        Ready work has no reserved quota.
      </p>
      <p class="next-step">
        {{ nextStep.text }}
      </p>
      <RouterLink
        v-if="nextStep.to"
        class="action"
        :to="nextStep.to"
      >
        {{ nextStep.label }} →
      </RouterLink>
      <p
        v-if="report.hasMore"
        class="coverage"
      >
        Partial view: first 50 pending rows per queue. More retries are not shown.
      </p>
      <details v-if="report.inspected">
        <summary>Coverage and timing</summary>
        <p>{{ isOmdb ? 'OMDb only; no retry-result cache. A retry may need an IMDb lookup and a title lookup.' : 'Web-search and legacy Tavily only; not OMDb, imports or classification.' }} Counts are retry records, not unique media. Ready is a preview, not completion.</p>
        <p v-if="isOmdb && report.quota.resetAt">
          Local daily reset estimate: <time :datetime="report.quota.resetAt">{{ formatTime(report.quota.resetAt) }}</time>. This is Classifarr's budget, not the upstream account balance.
        </p>
        <p v-if="report.earliestRetryAt">
          Earliest retry estimate: <time :datetime="report.earliestRetryAt">{{ formatTime(report.earliestRetryAt) }}</time>. The worker rechecks all safeguards.
        </p>
      </details>
    </template>
    <footer>
      <span v-if="report">Checked <time :datetime="report.observedAt">{{ formatTime(report.observedAt) }}</time></span>
      <span v-if="!paused && nextCheckAt">Next status check: <time :datetime="nextCheckAt">{{ formatTime(nextCheckAt) }}</time></span>
      <span v-if="paused">Display paused; background retries are unchanged.</span>
    </footer>
  </section>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRetryReadiness } from '@/composables/useRetryReadiness'
import { RETRY_READINESS_SEGMENTS, retryReadinessNextStep } from '@/utils/retryReadiness'

const props = defineProps({ scope: { type: String, default: 'web_search' }, initialPaused: { type: Boolean, default: false } })
const emit = defineEmits(['pause-change'])
const isOmdb = props.scope === 'omdb'
const headingId = `retry-readiness-heading-${props.scope}`
const { report, paused, unavailable, stale, forbidden, nextCheckAt, loading, togglePaused } = useRetryReadiness(props.scope, props.initialPaused)
watch(paused, value => emit('pause-change', value))
const ready = computed(() => report.value ? report.value.counts.cached_ready + report.value.counts.provider_ready : 0)
const segments = computed(() => RETRY_READINESS_SEGMENTS.filter(segment => !isOmdb || segment.id !== 'cached_ready').map(segment => ({ ...segment,
  count: report.value.counts[segment.id], percent: report.value.inspected ? report.value.counts[segment.id] * 100 / report.value.inspected : 0,
})))
const nextStep = computed(() => report.value ? retryReadinessNextStep(report.value) : {})
const chartSegments = computed(() => segments.value.filter(segment => segment.count > 0))
const statusText = computed(() => {
  if (unavailable.value) return 'Status unavailable'
  if (stale.value) return 'Status out of date'
  if (paused.value) return 'Updates paused'
  if (!report.value) return loading.value ? 'Checking readiness…' : 'Waiting for a status check'
  if (!report.value.inspected) return 'No retries waiting'
  if (report.value.counts.settings_blocked) return 'Provider settings need review'
  if (report.value.counts.held) return 'Some items are held'
  return ready.value ? 'Work is ready for recheck' : 'Waiting; not failed'
})
const formatTime = value => new Date(value).toLocaleString()
</script>

<style scoped>
.retry-readiness { padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid #475569; border-radius: .75rem; background: #1f2937; color: #e2e8f0; }
header, footer { display: flex; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
h2 { font-size: 1rem; font-weight: 700; color: #f8fafc; }
.state { font-size: .875rem; margin-top: .25rem; }
button { padding: .5rem .75rem; border: 1px solid #94a3b8; border-radius: .375rem; align-self: flex-start; }
button:focus-visible, summary:focus-visible, .action:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
.overview { display: flex; align-items: center; gap: 2rem; margin: 1rem 0; }
.ready-count { display: flex; flex-direction: column; min-width: 8rem; }
.ready-count strong { font-size: 2.75rem; line-height: 1.1; color: #f8fafc; }
.ready-count span { font-size: .875rem; margin-top: .35rem; }
.chart { flex: 1; min-width: 0; }
.stacked-bar { display: flex; height: 1rem; overflow: hidden; border-radius: .25rem; background: #475569; }
.stacked-bar span + span { border-left: 2px solid #1f2937; }
.legend { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: .5rem 1.5rem; margin-top: .75rem; }
.legend div { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; font-size: .875rem; }
dt { display: flex; align-items: center; gap: .5rem; }
dd { font-weight: 700; font-variant-numeric: tabular-nums; }
.swatch { width: .625rem; height: .625rem; flex-shrink: 0; border-radius: 2px; }
.next-step, .message { margin: .75rem 0; }
.action { color: #93c5fd; text-decoration: underline; text-underline-offset: 3px; }
.coverage { margin-top: .75rem; color: #fcd34d; font-size: .875rem; }
details { margin-top: .75rem; font-size: .875rem; }
summary { cursor: pointer; }
details p { margin-top: .5rem; }
.quota { font-size: .875rem; color: #cbd5e1; }
footer { margin-top: 1rem; font-size: .75rem; color: #cbd5e1; }
@media (max-width: 640px) { .overview { align-items: stretch; flex-direction: column; gap: 1rem; } .legend { grid-template-columns: 1fr; } }
</style>
