<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
    aria-labelledby="policy-purpose-coverage-heading"
  >
    <div class="border-b border-gray-700 p-5">
      <h2
        id="policy-purpose-coverage-heading"
        class="text-lg font-semibold"
      >
        Policy purpose coverage
      </h2>
      <p class="mt-1 max-w-3xl text-sm text-gray-400">
        This read-only review compares current declared native-purpose coverage for active destinations of the same media type. It does not expose rule values, inspect classified items, call AI, or change routing.
      </p>
    </div>

    <div
      v-if="loading"
      class="p-5 text-sm text-gray-400"
      role="status"
      aria-live="polite"
    >
      Loading current policy purpose coverage...
    </div>

    <div
      v-else-if="entries.length === 0"
      class="p-5 text-sm text-gray-400"
    >
      No active validated native policies are available for coverage review.
    </div>

    <template v-else>
      <dl class="grid gap-4 border-b border-gray-800 p-5 sm:grid-cols-3">
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Missing purpose coverage
          </dt>
          <dd class="mt-1 text-lg font-semibold text-amber-200">
            {{ summary.missingCoverageCount }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Broad overlap review
          </dt>
          <dd class="mt-1 text-lg font-semibold text-amber-200">
            {{ summary.broadOverlapCount }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Distinct declared coverage
          </dt>
          <dd class="mt-1 text-lg font-semibold text-green-200">
            {{ summary.declaredCoverageCount }}
          </dd>
        </div>
      </dl>

      <p
        v-if="summary.truncated"
        class="border-b border-amber-500/30 bg-amber-950/20 px-5 py-3 text-sm text-amber-100"
      >
        This bounded report shows the first {{ summary.reviewedPolicyCount }} active policies. It does not change the omitted policies.
      </p>

      <ul
        class="divide-y divide-gray-800"
        aria-label="Policy purpose coverage review"
      >
        <li
          v-for="entry in entries"
          :key="entry.policy.id"
          class="p-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p
                class="text-xs font-semibold uppercase tracking-wide"
                :class="statusClass(entry.coverage.statusId)"
              >
                {{ formatId(entry.coverage.statusId) }}
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

          <dl class="mt-4 grid gap-3 rounded border border-gray-700 bg-background/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Required content signals
              </dt>
              <dd class="mt-1 text-white">
                {{ entry.coverage.requiredSignalTypeCount }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Required terms
              </dt>
              <dd class="mt-1 text-white">
                {{ entry.coverage.requiredTermCount }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Unshared terms
              </dt>
              <dd class="mt-1 text-white">
                {{ entry.coverage.uniqueRequiredTermCount }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Shared terms
              </dt>
              <dd class="mt-1 text-white">
                {{ entry.coverage.sharedRequiredTermCount }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Overlapping destinations
              </dt>
              <dd class="mt-1 text-white">
                {{ entry.coverage.overlappingDestinationCount }}
              </dd>
            </div>
          </dl>

          <div class="mt-4 rounded border border-gray-700 bg-background/50 p-4">
            <p class="text-sm font-semibold text-white">
              {{ entry.action.title }}
            </p>
            <p class="mt-1 text-sm leading-6 text-gray-300">
              {{ entry.action.description }}
            </p>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  review: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'edit-policy': entry => Boolean(entry?.policy?.id),
})

const entries = computed(() => (
  Array.isArray(props.review?.entries) ? props.review.entries : []
))
const summary = computed(() => ({
  reviewedPolicyCount: Number(props.review?.summary?.reviewedPolicyCount) || entries.value.length,
  missingCoverageCount: Number(props.review?.summary?.missingCoverageCount) || 0,
  broadOverlapCount: Number(props.review?.summary?.broadOverlapCount) || 0,
  declaredCoverageCount: Number(props.review?.summary?.declaredCoverageCount) || 0,
  truncated: props.review?.summary?.truncated === true,
}))

function formatId(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unavailable'
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function statusClass(statusId) {
  return statusId === 'declared_specialized_coverage'
    ? 'text-green-200'
    : 'text-amber-200'
}
</script>
