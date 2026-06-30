<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="rounded-lg border p-4"
    :class="toneClass"
    aria-labelledby="policy-builder-routing-readiness-title"
  >
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <div>
        <p class="text-xs uppercase tracking-wider opacity-80">
          Routing Readiness
        </p>
        <h3
          id="policy-builder-routing-readiness-title"
          class="mt-1 text-lg font-semibold"
        >
          {{ readiness.label }}
        </h3>
        <p class="mt-2 text-sm opacity-90">
          {{ readiness.message }}
        </p>
      </div>

      <span
        class="inline-flex w-fit rounded-full border border-current/30 px-3 py-1 text-xs font-semibold"
      >
        {{ readiness.canRoute ? 'Ready' : 'Needs setup' }}
      </span>
    </div>

    <dl
      v-if="readiness.facts.length > 0"
      class="mt-4 grid gap-3 sm:grid-cols-3"
    >
      <div
        v-for="fact in readiness.facts"
        :key="fact.label"
        class="rounded-md border border-current/20 bg-black/10 p-3"
      >
        <dt class="text-xs uppercase tracking-wide opacity-70">
          {{ fact.label }}
        </dt>
        <dd class="mt-1 break-words text-sm font-medium">
          {{ fact.value }}
        </dd>
      </div>
    </dl>

    <a
      v-if="readiness.nextActionLabel && readiness.targetId"
      class="mt-4 inline-flex rounded-md border border-current/40 px-3 py-2 text-sm font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-current/60 focus:ring-offset-2 focus:ring-offset-gray-900"
      :href="`#${readiness.targetId}`"
    >
      {{ readiness.nextActionLabel }}
    </a>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  readiness: {
    type: Object,
    required: true,
  },
})

const toneClass = computed(() => {
  if (props.readiness.tone === 'success') {
    return 'border-green-800/70 bg-green-950/30 text-green-100'
  }

  return 'border-amber-700/70 bg-amber-950/30 text-amber-100'
})
</script>
