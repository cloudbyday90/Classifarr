<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { computed } from 'vue'
import { getOverallHealth } from '@/utils/serviceHealthSummary'
import { getStatusConfig } from '@/utils/healthStatus'

const props = defineProps({
  services: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  available: { type: Boolean, default: false },
  receivedAt: { type: String, default: '' },
  heartbeatActive: { type: Boolean, default: null },
  intervalMs: { type: Number, default: null },
})
const summary = computed(() => getOverallHealth(props.services, { observationAvailable: props.available }))
const style = computed(() => getStatusConfig(props.loading ? 'unknown' : summary.value.status))
</script>
<template>
  <section
    aria-label="Overall service health"
    class="p-4 rounded-lg border mb-4 min-w-0 break-words"
    :class="[style.bgClass, style.borderClass]"
    data-testid="system-health-summary"
  >
    <div
      role="status"
      aria-atomic="true"
    >
      <p class="text-xl font-semibold">
        {{ loading ? 'Checking service health…' : summary.message }}
      </p>
      <template v-if="!loading">
        <p
          v-if="heartbeatActive === false"
          class="mt-1 text-sm"
        >
          Automatic health checks are paused. Use Refresh for a new check; review heartbeat settings if this was unexpected.
        </p>
        <p
          v-if="!available"
          class="mt-1"
        >
          {{ receivedAt ? 'Showing last received results; current health is not verified.' : 'No successful health response received yet.' }}
        </p>
        <p
          v-if="available || receivedAt"
          class="mt-1 text-sm"
        >
          {{ summary.healthy }} of {{ summary.active }} active services reported healthy.
          {{ summary.unknown }} unknown; {{ summary.disabled }} disabled; {{ summary.notConfigured }} not configured.
        </p>
      </template>
    </div>
    <p
      v-if="intervalMs"
      class="mt-2 text-xs opacity-90"
    >
      Check cadence: {{ intervalMs / 60000 }} minutes, with 30 seconds of scheduling grace.
    </p>
    <p
      v-if="receivedAt"
      class="mt-2 text-xs opacity-90"
    >
      Results received (UTC): {{ receivedAt }}. Individual check times are shown below.
    </p>
  </section>
</template>
