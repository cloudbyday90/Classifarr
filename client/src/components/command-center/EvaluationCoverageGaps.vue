<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div>
    <h3>What is waiting, and why?</h3>
    <p>
      {{ group.eligible - group.selected }} eligible items have not reached a selected window.
      {{ group.selected - group.paired }} selected items have no completed comparison in retained history.
    </p>
    <ul
      v-if="reasons.length"
      aria-label="Saved comparison gaps"
    >
      <li
        v-for="reason in reasons"
        :key="reason.key"
      >
        <strong>{{ reason.count }} — {{ reason.title }}.</strong> {{ reason.guidance }}
      </li>
    </ul>
    <p v-if="reasons.length">
      Each unfinished item appears once using its latest recorded blocking reason.
      A blocking reason takes precedence over a missing response in the other arm.
    </p>
    <p>
      Missing reference labels are separate from these gaps: extra AI calls cannot supply independent ground truth.
      No retries are started by opening this summary.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { evaluationGapDetails } from '@/utils/evaluationCoverageGaps'
const props = defineProps({ group: { type: Object, required: true } })
const reasons = computed(() => Object.entries(evaluationGapDetails).flatMap(([key, [title, guidance]]) =>
  props.group.gaps[key] ? [{ key, title, guidance, count: props.group.gaps[key] }] : []))
</script>

<style scoped>
h3 { margin-top: .75rem; font-weight: 600; }
p, li { margin-top: .5rem; font-size: .875rem; line-height: 1.5; }
ul { list-style: disc; padding-left: 1.25rem; }
</style>
