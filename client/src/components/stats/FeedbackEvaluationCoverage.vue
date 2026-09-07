<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <p class="evaluation-coverage">
    Accuracy uses {{ stats.evaluated_decisions || 0 }} of {{ stats.total_decisions || 0 }}
    recorded decisions. Unevaluated observations remain in the activity totals.
    N/A means no evaluated evidence is available.
  </p>
</template>

<script setup>
defineProps({ stats: { type: Object, required: true } })
</script>

<style scoped>
.evaluation-coverage { color: #9ca3af; font-size: 0.875rem; margin: 1rem 0; }
</style>
