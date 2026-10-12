<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { computed } from 'vue'
import { getPgvectorStartupPresentation } from '@/utils/pgvectorStartupPresentation'

const props = defineProps({
  pgvector: { type: Object, default: null },
  version: { type: String, default: null },
})
const presentation = computed(() => getPgvectorStartupPresentation(props.pgvector))
const report = computed(() => presentation.value.selection)
</script>

<template>
  <section
    class="min-w-0 space-y-3 text-sm break-words"
    aria-labelledby="pgvector-startup-heading"
    data-testid="pgvector-startup-panel"
  >
    <h3
      id="pgvector-startup-heading"
      class="font-medium text-gray-200"
    >
      pgvector startup compatibility
    </h3>
    <p
      class="font-medium"
      data-testid="pgvector-compatibility-label"
    >
      {{ presentation.label }}
    </p>
    <p>{{ presentation.detail }}</p>
    <p>
      For operational checks, see Database and RAG in Health Status above.
      Startup compatibility is not included in service-health totals.
    </p>
    <dl class="grid grid-cols-1 md:grid-cols-2 gap-2">
      <div>
        <dt class="text-gray-400">
          Extension version reported
        </dt><dd>{{ version || 'unknown' }}</dd>
      </div>
      <div>
        <dt class="text-gray-400">
          Reported build
        </dt><dd>{{ presentation.build }}</dd>
      </div>
      <div>
        <dt class="text-gray-400">
          Reported selected variant
        </dt><dd>{{ presentation.selectedVariant }}</dd>
      </div>
      <div>
        <dt class="text-gray-400">
          Reported CPU AVX
        </dt><dd>{{ presentation.cpuAvx }}</dd>
      </div>
      <div>
        <dt class="text-gray-400">
          Reported CPU AVX2
        </dt><dd>{{ presentation.cpuAvx2 }}</dd>
      </div>
    </dl>
    <div
      class="space-y-2"
      data-testid="pgvector-startup-report"
    >
      <p>{{ report.summary }}</p>
      <p>{{ report.advice }}</p>
      <p>Scope: {{ report.scope }}. This is a startup observation, not a loaded-binary or database-health check.</p>
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <dt class="text-gray-400">
            Application-run reference
          </dt><dd>{{ report.reference }}</dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Recorded (UTC)
          </dt><dd>{{ report.recordedAt }}</dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Selected (UTC)
          </dt><dd>{{ report.selectedAt }}</dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Database started (UTC)
          </dt><dd>{{ report.databaseStartedAt }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
