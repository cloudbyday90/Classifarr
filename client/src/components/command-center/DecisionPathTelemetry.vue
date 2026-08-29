<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="telemetryView"
    class="decision-path-telemetry"
    aria-labelledby="decision-path-telemetry-heading"
  >
    <h4 id="decision-path-telemetry-heading">
      Recent decision paths
    </h4>
    <p>
      Last {{ telemetryView.hours }} hours. Aggregate counts only; signals can overlap.
    </p>
    <dl>
      <div>
        <dt>AI was not needed</dt>
        <dd>{{ telemetryView.deterministicPolicy }}</dd>
      </div>
      <div>
        <dt>AI classification attempted</dt>
        <dd>{{ telemetryView.aiClassificationAttempt }}</dd>
      </div>
      <div>
        <dt>AI unavailable — retry queued</dt>
        <dd>{{ telemetryView.aiUnavailableRetry }}</dd>
      </div>
      <div>
        <dt>Strict verification abstained</dt>
        <dd>{{ telemetryView.strictVerificationAbstention }}</dd>
      </div>
    </dl>
    <p class="decision-path-telemetry-note">
      This includes only decisions recorded by the current decision-path contract. It does not expose media, AI content, or configuration details.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const TELEMETRY_VERSION = 'classification.decision_path_telemetry.v1'

const props = defineProps({
  telemetry: { type: Object, default: null },
})

function count(value) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

const telemetryView = computed(() => {
  const source = props.telemetry
  if (!source || source.version !== TELEMETRY_VERSION) return null

  const hours = Number(source.window?.hours)
  const deterministicPolicy = count(source.counts?.deterministicPolicy)
  const aiClassificationAttempt = count(source.counts?.aiClassificationAttempt)
  const aiUnavailableRetry = count(source.counts?.aiUnavailableRetry)
  const strictVerificationAbstention = count(source.counts?.strictVerificationAbstention)

  if (!Number.isSafeInteger(hours) || hours <= 0 || hours > 168 ||
      deterministicPolicy === null || aiClassificationAttempt === null ||
      aiUnavailableRetry === null || strictVerificationAbstention === null) {
    return null
  }

  return {
    hours,
    deterministicPolicy,
    aiClassificationAttempt,
    aiUnavailableRetry,
    strictVerificationAbstention,
  }
})
</script>

<style scoped>
.decision-path-telemetry {
  margin-top: 1rem;
  padding: 0.875rem;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.55);
}

.decision-path-telemetry h4 {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #dbeafe;
}

.decision-path-telemetry > p {
  margin: 0.375rem 0 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.decision-path-telemetry dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0.75rem 0 0;
}

.decision-path-telemetry dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  background: rgba(30, 41, 59, 0.72);
}

.decision-path-telemetry dt,
.decision-path-telemetry dd {
  margin: 0;
  font-size: 0.75rem;
}

.decision-path-telemetry dt {
  color: #cbd5e1;
}

.decision-path-telemetry dd {
  font-weight: 700;
  color: #f8fafc;
}

.decision-path-telemetry-note {
  color: #64748b !important;
}

@media (max-width: 32rem) {
  .decision-path-telemetry dl {
    grid-template-columns: 1fr;
  }
}
</style>
