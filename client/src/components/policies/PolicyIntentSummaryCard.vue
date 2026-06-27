<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4"
    aria-label="Policy intent summary"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 class="font-semibold flex items-center gap-2">
          <span
            class="text-primary"
            aria-hidden="true"
          >
            🧾
          </span>
          Policy Behavior Summary
        </h4>
        <p class="text-xs text-gray-400 mt-1 max-w-2xl">
          A read-only summary of what this policy currently means. Starter
          templates remain the compatibility layer, but intent is the product
          model operators should reason about.
        </p>
      </div>
      <span
        class="text-xs px-2 py-1 rounded-full border"
        :class="summary.has_warnings ? 'border-red-700 text-red-300 bg-red-900/20' : 'border-green-700 text-green-300 bg-green-900/20'"
      >
        {{ summary.has_warnings ? 'Needs review' : 'Looks complete' }}
      </span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <div
        v-for="section in sections"
        :key="section.key"
        class="rounded-lg border border-gray-700 bg-background-light p-3 space-y-2"
      >
        <div>
          <div class="text-sm font-semibold text-white">
            {{ section.label }}
          </div>
          <p class="text-xs text-gray-400">
            {{ section.help }}
          </p>
        </div>

        <div class="space-y-1">
          <div
            v-for="item in section.items"
            :key="section.key + ':' + item.text + ':' + item.source"
            class="rounded-sm px-2 py-1 text-xs"
            :class="toneClass(section.tone)"
          >
            <div class="font-medium">
              {{ item.text }}
            </div>
            <div class="text-[11px] opacity-75">
              {{ item.source }}
            </div>
          </div>

          <div
            v-if="section.items.length === 0"
            class="text-xs text-gray-500"
          >
            {{ section.emptyText }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
})

const sections = computed(() => Array.isArray(props.summary?.sections) ? props.summary.sections : [])

const toneClass = (tone) => {
  if (tone === 'green') return 'bg-green-900/30 text-green-200'
  if (tone === 'amber') return 'bg-amber-900/30 text-amber-200'
  if (tone === 'blue') return 'bg-blue-900/30 text-blue-200'
  if (tone === 'red') return 'bg-red-900/30 text-red-200'
  return 'bg-gray-800 text-gray-300'
}
</script>
