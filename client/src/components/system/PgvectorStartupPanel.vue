<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { computed } from 'vue'
import { getPgvectorStartupPresentation } from '@/utils/pgvectorStartupPresentation'

const props = defineProps({
  pgvector: { type: Object, default: null },
  version: { type: String, default: null },
})
const presentation = computed(() => getPgvectorStartupPresentation(props.pgvector))
const variantLabels = new Map([['multi', 'Multi-variant'], ['generic', 'Generic'], ['avx', 'AVX'], ['avx2', 'AVX2']])
const facts = computed(() => [
  { key: 'version', label: 'Version', value: props.version || 'Unknown' },
  { key: 'build', label: 'Build', value: presentation.value.current ? variantLabels.get(presentation.value.build) || 'Unknown' : 'Unknown' },
  { key: 'selected-variant', label: 'Selected optimization', value: presentation.value.current ? variantLabels.get(presentation.value.selectedVariant) || 'Unknown' : 'Unknown' },
  { key: 'cpu-avx', label: 'CPU supports AVX', value: presentation.value.current ? presentation.value.cpuAvx : 'Unknown' },
  { key: 'cpu-avx2', label: 'CPU supports AVX2', value: presentation.value.current ? presentation.value.cpuAvx2 : 'Unknown' },
])
</script>

<template>
  <section
    class="min-w-0 space-y-2 text-sm break-words"
    aria-labelledby="pgvector-startup-heading"
    data-testid="pgvector-startup-panel"
  >
    <h3
      id="pgvector-startup-heading"
      class="font-medium text-gray-400"
    >
      pgvector
    </h3>
    <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
      <div
        v-for="fact in facts"
        :key="fact.key"
        class="flex justify-between gap-4"
      >
        <dt class="text-gray-400">
          {{ fact.label }}
        </dt>
        <dd
          :data-testid="`pgvector-${fact.key}`"
          class="text-right"
        >
          {{ fact.value }}
        </dd>
      </div>
    </dl>
    <p
      v-if="presentation.cpuMismatch"
      class="text-yellow-300"
      data-testid="pgvector-cpu-warning"
    >
      Selected optimization is not supported by this CPU. Check the container image.
    </p>
  </section>
</template>
