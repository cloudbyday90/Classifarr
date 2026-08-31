<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-scoped-evidence-digest"
    ref="rootElement"
    tabindex="-1"
    class="rounded-lg border border-gray-700 bg-background-light p-5"
    aria-labelledby="policy-scoped-evidence-digest-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-primary">
          Selected policy only
        </p>
        <h2
          id="policy-scoped-evidence-digest-heading"
          class="mt-1 text-lg font-semibold"
        >
          Policy evidence digest
        </h2>
        <p class="mt-1 max-w-3xl text-sm text-gray-400">
          Read-only provenance and bounded history for the selected policy. This does not inspect media now, call AI, modify learning, alter a score, or route an item.
        </p>
      </div>
      <span
        class="rounded-full border px-2 py-1 text-xs font-medium"
        :class="availabilityClass"
      >
        {{ availabilityLabel }}
      </span>
    </div>

    <p
      v-if="loading"
      class="mt-4 text-sm text-gray-400"
      role="status"
      aria-live="polite"
    >
      Loading selected policy evidence…
    </p>

    <p
      v-else-if="!available"
      class="mt-4 rounded border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-100"
    >
      The selected policy’s evidence digest is currently unavailable. Refresh status to try again; no policy or route has changed.
    </p>

    <template v-else>
      <p class="mt-4 text-sm text-gray-300">
        <span class="font-medium text-white">{{ digest.policy?.name }}</span>
        <span v-if="digest.policy?.library?.name"> · {{ digest.policy.library.name }}</span>
        <span v-if="digest.policy?.library?.mediaType"> · {{ digest.policy.library.mediaType }}</span>
      </p>

      <dl class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded border border-gray-700 bg-background/50 p-4">
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Declared intent
          </dt>
          <dd class="mt-2 text-sm font-semibold text-white">
            {{ formatId(digest.declaredIntent?.authority?.stateId) }}
          </dd>
          <p class="mt-1 text-sm text-gray-300">
            {{ digest.declaredIntent?.purposeRuleCount ?? 0 }} purpose rule{{ pluralSuffix(digest.declaredIntent?.purposeRuleCount) }} across {{ purposeSignalTypeCount }} signal type{{ pluralSuffix(purposeSignalTypeCount) }}.
          </p>
        </div>

        <div class="rounded border border-gray-700 bg-background/50 p-4">
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Observed library profile
          </dt>
          <dd class="mt-2 text-sm font-semibold text-white">
            {{ formatId(digest.observedLibraryProfile?.statusId) }}
          </dd>
          <p class="mt-1 text-sm text-gray-300">
            {{ profileDescription }}
          </p>
        </div>

        <div class="rounded border border-gray-700 bg-background/50 p-4">
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Policy-authorized history
          </dt>
          <dd class="mt-2 text-sm font-semibold text-white">
            {{ digest.admittedHistory?.admissionCount ?? 0 }} admission{{ pluralSuffix(digest.admittedHistory?.admissionCount) }}
          </dd>
          <p class="mt-1 text-sm text-gray-300">
            Last {{ digest.admittedHistory?.windowDays ?? 0 }} days · {{ admittedSignalTypeCount }} signal type{{ pluralSuffix(admittedSignalTypeCount) }}.
          </p>
        </div>
      </dl>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <article class="rounded border border-gray-700 bg-background/50 p-4">
          <h3 class="text-sm font-semibold text-white">
            Provenance boundary
          </h3>
          <ul class="mt-2 space-y-1 text-sm text-gray-300">
            <li>Stored profile source: {{ formatId(digest.observedLibraryProfile?.sourceId) }}</li>
            <li>Profile freshness: {{ formatId(digest.observedLibraryProfile?.freshnessState) }}</li>
            <li>Profile payload: {{ digest.observedLibraryProfile?.payloadRedacted === true ? 'redacted' : 'not returned' }}</li>
          </ul>
        </article>

        <article class="rounded border border-gray-700 bg-background/50 p-4">
          <h3 class="text-sm font-semibold text-white">
            Uncertainty to keep in view
          </h3>
          <p
            v-if="uncertaintyReasonIds.length === 0"
            class="mt-2 text-sm text-green-200"
          >
            No bounded uncertainty conditions are currently reported by this digest.
          </p>
          <ul
            v-else
            class="mt-2 space-y-1 text-sm text-amber-100"
          >
            <li
              v-for="reasonId in uncertaintyReasonIds"
              :key="reasonId"
            >
              {{ uncertaintyMessage(reasonId) }}
            </li>
          </ul>
        </article>
      </div>

      <p class="mt-4 text-xs text-gray-500">
        Evaluated {{ formatTimestamp(digest.evaluatedAt) }}. No media titles, rule values, event identifiers, profile payload, or model output is shown.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  digest: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const rootElement = ref(null)
const available = computed(() => props.digest?.statusId === 'available')
const purposeSignalTypeCount = computed(() => (
  Array.isArray(props.digest?.declaredIntent?.purposeSignalTypes)
    ? props.digest.declaredIntent.purposeSignalTypes.length
    : 0
))
const admittedSignalTypeCount = computed(() => (
  Array.isArray(props.digest?.admittedHistory?.signalTypes)
    ? props.digest.admittedHistory.signalTypes.length
    : 0
))
const uncertaintyReasonIds = computed(() => (
  Array.isArray(props.digest?.uncertaintyReasonIds) ? props.digest.uncertaintyReasonIds : []
))
const availabilityLabel = computed(() => available.value ? 'Read-only evidence' : 'Evidence unavailable')
const availabilityClass = computed(() => available.value
  ? 'border-primary/60 text-primary'
  : 'border-amber-500/60 text-amber-100'
)
const profileDescription = computed(() => {
  const profile = props.digest?.observedLibraryProfile
  if (profile?.statusId !== 'captured') return 'No current stored profile is available for this policy.'
  return `Stored profile is ${formatId(profile.freshnessState).toLowerCase()}.`
})

function pluralSuffix(value) {
  return Number(value) === 1 ? '' : 's'
}

function formatId(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unavailable'
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function formatTimestamp(value) {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? 'Unavailable' : timestamp.toLocaleString()
}

function uncertaintyMessage(reasonId) {
  const messages = {
    declared_intent_not_authoritative: 'The active declared intent is not authoritative, so it should be reviewed before relying on it.',
    observed_profile_not_captured: 'A stored observed library profile is not currently available for comparison.',
    observed_profile_not_current: 'The stored observed library profile is not current.',
    no_policy_authorized_history_in_window: 'No policy-authorized identity admissions were retained in this fixed history window.',
  }
  return messages[reasonId] || formatId(reasonId)
}

function focus() {
  rootElement.value?.focus()
}

defineExpose({ focus })
</script>
