<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="recovery-progress-title"
    class="rounded-xl border border-gray-600 bg-gray-800 p-4 sm:p-6"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2
        id="recovery-progress-title"
        class="text-xl font-bold"
      >
        Automatic recovery progress
      </h2>
      <p class="text-sm text-gray-300">
        After verified TMDb credential recovery
      </p>
    </div>
    <div class="my-5 flex flex-wrap items-baseline gap-3">
      <strong class="text-4xl tabular-nums">{{ percentage }}</strong>
      <span>{{ report.stages.recovered }} of {{ report.total }} measured cases recovered</span>
    </div>
    <div
      v-if="report.total"
      class="flex h-6 w-full overflow-hidden rounded"
      aria-hidden="true"
    >
      <div
        v-for="stage in stages"
        :key="stage.id"
        :style="{ width: `${stage.count / report.total * 100}%`, backgroundColor: stage.color }"
      />
    </div>
    <ul
      class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-label="Recovery stage counts"
    >
      <li
        v-for="stage in stages"
        :key="stage.id"
        class="flex items-center gap-2"
      >
        <span
          class="h-3 w-3 shrink-0 rounded-sm"
          :style="{ backgroundColor: stage.color }"
          aria-hidden="true"
        />
        <span>{{ stage.label }} <strong class="tabular-nums">{{ stage.count }}</strong></span>
      </li>
    </ul>
    <div class="mt-5 grid gap-4 border-t border-gray-600 pt-4 sm:grid-cols-2">
      <p><span class="block text-sm text-gray-300">Median eligible → queued</span><strong>{{ recoveryDuration(report.eligibleToQueue.seconds) }}</strong><span class="ml-2 text-sm text-gray-300">({{ report.eligibleToQueue.samples }} measured)</span></p>
      <p><span class="block text-sm text-gray-300">Median queued → saved</span><strong>{{ recoveryDuration(report.queueToRecovery.seconds) }}</strong><span class="ml-2 text-sm text-gray-300">({{ report.queueToRecovery.samples }} measured)</span></p>
    </div>
    <p class="mt-5 rounded-lg border border-gray-500 p-3">
      <strong>Next:</strong> {{ recoveryNextStep(report) }}
    </p>
    <p class="mt-3 text-sm text-gray-300">
      {{ recoveryReadinessLabel(report.readiness) }}
    </p>
    <p class="mt-2 text-xs text-gray-300">
      {{ report.truncated ? 'Latest 1,000' : 'Retained' }} current-case wakeups from the last 30 days in active movie/TV libraries. Not all failures or placement accuracy. Older milestones are not reconstructed. As of {{ recoveryDate(report.asOf) }}.
    </p>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { RECOVERY_STAGES, recoveryDuration, recoveryNextStep, recoveryReadinessLabel } from '@/utils/inventoryRecoveryProgress'
import { recoveryDate } from '@/utils/inventoryRecovery'
const props = defineProps({ report: { type: Object, required: true } })
const stages = computed(() => RECOVERY_STAGES.map(stage => ({ ...stage, count: props.report.stages[stage.id] })))
const percentage = computed(() => props.report.total ? `${Math.floor(props.report.stages.recovered / props.report.total * 1000) / 10}%` : '—')
</script>
