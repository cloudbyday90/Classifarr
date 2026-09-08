<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-purpose-coverage-review"
    ref="rootElement"
    tabindex="-1"
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
        This read-only review compares current declared native-purpose coverage for active destinations of the same media type, including shared “any” alternatives that can make a broad match possible. It does not expose rule values, inspect classified items, call AI, or change routing.
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
      <dl class="grid gap-4 border-b border-gray-800 p-5 sm:grid-cols-3 xl:grid-cols-6">
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
            Profile-only purpose
          </dt>
          <dd class="mt-1 text-lg font-semibold text-amber-200">
            {{ summary.profileOnlyPurposeCount }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Retained purpose
          </dt>
          <dd class="mt-1 text-lg font-semibold text-green-200">
            {{ summary.retainedPurposeCount }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            No specialized purpose
          </dt>
          <dd class="mt-1 text-lg font-semibold text-amber-200">
            {{ summary.noSpecializedPurposeCount }}
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
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded border border-gray-500 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
                @click="emit('review-evidence', entry)"
              >
                Review evidence
              </button>
              <button
                v-if="entry.action.available"
                type="button"
                class="rounded border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
                @click="emit('edit-policy', entry)"
              >
                {{ entry.action.actionLabel }}
              </button>
            </div>
          </div>

          <dl class="mt-4 grid gap-3 rounded border border-gray-700 bg-background/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Shared “any” alternatives
              </dt>
              <dd class="mt-1 text-white">
                {{ sharedRequireAnyTermCount(entry) }}
                <span
                  v-if="sharedRequireAnyDestinationCount(entry) > 0"
                  class="text-gray-400"
                >
                  across {{ sharedRequireAnyDestinationCount(entry) }} destination{{ sharedRequireAnyDestinationCount(entry) === 1 ? '' : 's' }}
                </span>
              </dd>
            </div>
          </dl>

          <div
            v-if="provenance(entry)"
            class="mt-4 rounded border border-gray-700 bg-background/50 p-4"
          >
            <p
              class="text-sm font-semibold"
              :class="provenanceClass(provenance(entry).statusId)"
            >
              {{ formatId(provenance(entry).statusId) }}
            </p>
            <p class="mt-1 text-sm leading-6 text-gray-300">
              {{ provenanceDescription(provenance(entry).statusId) }}
            </p>
            <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-xs uppercase tracking-wide text-gray-400">
                  Specialized purpose rules
                </dt>
                <dd class="mt-1 text-white">
                  {{ provenance(entry).specializedPurposeRuleCount }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-gray-400">
                  Inferred profile rules
                </dt>
                <dd class="mt-1 text-white">
                  {{ provenance(entry).inferredProfilePurposeRuleCount }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-gray-400">
                  Retained purpose rules
                </dt>
                <dd class="mt-1 text-white">
                  {{ provenance(entry).retainedPurposeRuleCount }}
                </dd>
              </div>
            </dl>
          </div>

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
import { computed, ref } from 'vue'

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
  'review-evidence': entry => Boolean(entry?.policy?.id),
})

const rootElement = ref(null)

const entries = computed(() => (
  Array.isArray(props.review?.entries) ? props.review.entries : []
))
const summary = computed(() => ({
  reviewedPolicyCount: Number(props.review?.summary?.reviewedPolicyCount) || entries.value.length,
  missingCoverageCount: Number(props.review?.summary?.missingCoverageCount) || 0,
  broadOverlapCount: Number(props.review?.summary?.broadOverlapCount) || 0,
  declaredCoverageCount: Number(props.review?.summary?.declaredCoverageCount) || 0,
  profileOnlyPurposeCount: Number(props.review?.summary?.profileOnlyPurposeCount) || 0,
  retainedPurposeCount: Number(props.review?.summary?.retainedPurposeCount) || 0,
  noSpecializedPurposeCount: Number(props.review?.summary?.noSpecializedPurposeCount) || 0,
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

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : 0
}

function sharedRequireAnyTermCount(entry) {
  return nonNegativeCount(entry?.coverage?.sharedRequireAnyTermCount)
}

function sharedRequireAnyDestinationCount(entry) {
  return nonNegativeCount(entry?.coverage?.sharedRequireAnyDestinationCount)
}

function provenance(entry) {
  const value = entry?.provenance
  if (typeof value?.statusId !== 'string' || !value.statusId.trim()) return null

  return {
    statusId: value.statusId,
    specializedPurposeRuleCount: nonNegativeCount(value.specializedPurposeRuleCount),
    inferredProfilePurposeRuleCount: nonNegativeCount(value.inferredProfilePurposeRuleCount),
    retainedPurposeRuleCount: nonNegativeCount(value.retainedPurposeRuleCount),
  }
}

function provenanceClass(statusId) {
  return statusId === 'retained_specialized_purpose_available'
    ? 'text-green-200'
    : 'text-amber-200'
}

function provenanceDescription(statusId) {
  if (statusId === 'profile_only_specialized_purpose') {
    return 'Every specialized purpose rule is inferred from existing library contents. It is observed evidence and does not independently select a held-out semantic study case.'
  }
  if (statusId === 'retained_specialized_purpose_available') {
    return 'At least one specialized purpose rule is retained outside inferred library-profile evidence. This review remains advisory and does not establish semantic correctness or routing authority.'
  }
  return 'No specialized genre, keyword, or studio purpose rule is currently declared. Existing library contents, media type, history, profiles, RAG, and AI output do not substitute for declared purpose.'
}

function focus() {
  rootElement.value?.focus()
}

defineExpose({ focus })
</script>
