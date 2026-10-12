<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { computed } from 'vue'
import { healthFreshnessGuidance } from '@/utils/healthObservationFreshness'
import { getStatusConfig } from '@/utils/healthStatus'
const props = defineProps({
  state: { type: String, default: 'unknown' },
  reason: { type: String, default: '' },
  observedStatus: { type: String, default: 'unknown' },
  checkedAt: { type: String, default: '' },
  expiresAt: { type: String, default: '' },
})
const guidance = computed(() => healthFreshnessGuidance(props.state, props.reason))
</script>
<template>
  <div
    v-if="guidance"
    class="mt-2 text-xs text-gray-300 break-words"
    data-testid="health-freshness-note"
  >
    <p>{{ guidance }}</p>
    <p>Last reported status: {{ getStatusConfig(observedStatus).label }}. This is not a current result.</p>
    <p v-if="checkedAt">
      Checked (UTC): {{ checkedAt }}
    </p>
    <p v-if="expiresAt">
      Freshness deadline (UTC): {{ expiresAt }}
    </p>
  </div>
</template>
