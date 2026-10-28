<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="evidence-gap-audit-heading"
    class="gap-audit"
  >
    <h3 id="evidence-gap-audit-heading">
      Comparison evidence audit
    </h3>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ errorMessage || (loading && !audit ? 'Loading saved evidence audit…' : evidenceGapAuditMessage(audit)) }}
    </p>
    <p v-if="paused">
      Audit presentation is paused. Old counts are still withheld when they become stale.
    </p>
    <p v-if="audit?.status === 'complete' && audit.report">
      This is evidence coverage, not accuracy or an assessment of historical recovery. No AI calls or routing changes are made by this audit.
    </p>
    <details>
      <summary>Audit reasons and scope</summary>
      <template v-if="audit?.status === 'complete' && audit.report">
        <p>{{ audit.report.intake.capped ? 'At least ' : '' }}{{ audit.report.intake.recordedMovieTvEvents }} retained movie/TV history events.</p>
        <p v-if="!audit.report.intake.capped">
          {{ audit.report.intake.withoutRetainedComparison }} have no retained comparison. A strong decision can legitimately follow a different path.
        </p>
        <p v-else>
          The intake count is capped; an exact missing-comparison count is unavailable.
        </p>
        <h4>Comparison exclusions</h4>
        <dl>
          <template
            v-for="(label, key) in auditCaptureLabels"
            :key="key"
          >
            <dt>{{ label }}</dt><dd>{{ audit.report.comparisons.exclusions[key] }}</dd>
          </template>
        </dl>
        <p>{{ audit.report.comparisons.observationOverflowCaptures }} representative comparison groups exceeded the observation limit; this is included in invalid comparisons.</p>
        <h4>Bounded observation diagnostics</h4>
        <p>These reasons overlap and include duplicate comparisons. Do not add them as missing items or use them as a percentage.</p>
        <p v-if="audit.report.observations.mayBeTruncated">
          {{ audit.report.observations.groupsAtLimit }} inspected groups reached the limit. Later observations may be omitted.
        </p>
        <dl>
          <template
            v-for="(label, key) in auditObservationLabels"
            :key="key"
          >
            <dt>{{ label }}</dt><dd>{{ audit.report.observations.reasons[key] }}</dd>
          </template>
        </dl>
        <p>Only retained thirty-day comparisons are inspected. Current placement does not supply missing identity or action proof; historical recovery is not assessed.</p>
      </template>
      <p v-else>
        No verified audit counts are available. Missing, failed or stale evidence is not a zero-gap result.
      </p>
    </details>
    <p v-if="audit?.observedAt">
      Audit snapshot: <time :datetime="audit.observedAt">{{ new Date(audit.observedAt).toLocaleString() }}</time>. Request time does not refresh this snapshot.
    </p>
  </section>
</template>

<script setup>
import { auditCaptureLabels, auditObservationLabels, evidenceGapAuditMessage } from '@/utils/evidenceGapAuditPresentation'
defineProps({ audit: { type: Object, default: null }, loading: Boolean, paused: Boolean, errorMessage: { type: String, default: '' } })
</script>

<style scoped>
.gap-audit { margin-top: .75rem; padding-top: .5rem; border-top: 1px solid #475569; }
h3, h4 { font-weight: 600; margin-top: .5rem; }
p, dt, dd { margin-top: .4rem; font-size: .875rem; line-height: 1.5; }
dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .25rem .75rem; }
summary { color: #bfdbfe; cursor: pointer; min-height: 2rem; }
summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
