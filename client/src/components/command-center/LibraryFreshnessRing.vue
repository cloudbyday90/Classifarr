<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    class="freshness-ring"
    :aria-label="`${current} of ${total} library summaries current (${percentage}%)`"
    role="img"
  >
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="50"
        cy="50"
        r="42"
        class="track"
      />
      <circle
        cx="50"
        cy="50"
        r="42"
        class="fill"
        pathLength="100"
        :stroke-dasharray="`${percentage} 100`"
      />
    </svg>
    <span aria-hidden="true">{{ percentage }}<small>%</small></span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ current: { type: Number, required: true }, total: { type: Number, required: true } })
// The parent only renders a percentage for a known, positive denominator.
const percentage = computed(() => props.total > 0 ? Math.min(100, Math.max(0, Math.round(props.current / props.total * 100))) : 0)
</script>
<style scoped>
.freshness-ring { width: 7rem; height: 7rem; position: relative; flex-shrink: 0; }
svg { width: 100%; height: 100%; transform: rotate(-90deg); }
circle { fill: none; stroke-width: 7; }
.track { stroke: #475569; } .fill { stroke: #6ee7b7; }
span { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; font-size: 1.75rem; font-weight: 750; }
small { font-size: 1rem; }
</style>
