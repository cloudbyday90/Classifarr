<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
    aria-labelledby="reconciliation-remediation-heading"
  >
    <div class="border-b border-gray-700 p-5">
      <h2
        id="reconciliation-remediation-heading"
        class="text-lg font-semibold"
      >
        Policy remediation
      </h2>
      <p class="mt-1 max-w-3xl text-sm text-gray-400">
        Review each unresolved policy in place. Classifarr never guesses a destination purpose from a library name, profile, history, or AI response.
      </p>
    </div>

    <div
      v-if="loading"
      class="p-5 text-sm text-gray-400"
      role="status"
      aria-live="polite"
    >
      Loading current remediation inventory...
    </div>

    <div
      v-else-if="entries.length === 0"
      class="p-5 text-sm text-gray-400"
    >
      No unresolved reconciliation policies currently need an operator remediation.
    </div>

    <ul
      v-else
      class="divide-y divide-gray-800"
      aria-label="Unresolved policy remediation inventory"
    >
      <li
        v-for="entry in entries"
        :id="`policy-reconciliation-remediation-${entry.policy.id}`"
        :key="entry.policy.id"
        :tabindex="entry.policy.id === focusPolicyId ? -1 : null"
        class="p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-amber-200">
              {{ formatId(entry.reconciliation.outcomeState) }}
            </p>
            <h3 class="mt-1 text-base font-semibold text-white">
              {{ entry.policy.name }}
            </h3>
            <p class="mt-1 text-sm text-gray-300">
              {{ entry.library.name }}<span v-if="entry.library.mediaType"> · {{ entry.library.mediaType }}</span>
            </p>
          </div>
          <button
            v-if="entry.action.available"
            type="button"
            class="rounded border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
            @click="emit('edit-policy', entry)"
          >
            {{ entry.action.actionLabel }}
          </button>
        </div>

        <div class="mt-4 rounded border border-gray-700 bg-background/50 p-4">
          <p class="text-sm font-semibold text-white">
            {{ entry.action.title }}
          </p>
          <p class="mt-1 text-sm leading-6 text-gray-300">
            {{ entry.action.description }}
          </p>
          <p class="mt-3 text-xs leading-5 text-gray-400">
            {{ entry.action.schedulerFollowUp }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  inventory: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  focusPolicyId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits({
  'edit-policy': entry => Boolean(entry?.policy?.id),
})

const entries = computed(() => (
  Array.isArray(props.inventory?.entries) ? props.inventory.entries : []
))

function formatId(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Needs review'
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}
</script>
