<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="suggestion"
    class="rounded-lg border border-primary/50 bg-primary/10 p-4"
    aria-labelledby="compatibility-profile-purpose-suggestion-title"
  >
    <h3
      id="compatibility-profile-purpose-suggestion-title"
      class="text-base font-semibold text-white"
    >
      Profile-based purpose suggestion
    </h3>
    <p class="mt-1 text-sm leading-6 text-gray-200">
      This is a read-only suggestion from the current library profile. It does not change this policy, routing, learning, or AI behavior until you add it to the draft and save normally.
    </p>

    <template v-if="suggestion.available">
      <p class="mt-3 text-xs text-gray-300">
        Based on {{ profileSummary }}.
      </p>
      <div class="mt-3 rounded border border-primary/30 bg-background/50 p-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-primary-200">
          Suggested Belongs Here rule
        </p>
        <ul class="mt-2 space-y-2 text-sm text-gray-100">
          <li
            v-for="rule in suggestion.suggestion.rules"
            :key="`${rule.signalType}:${rule.operator}`"
          >
            Genres include any of: <span class="font-medium">{{ rule.values.join(', ') }}</span>
          </li>
        </ul>
      </div>
      <p
        v-if="selectedPresetCount !== 1"
        class="mt-3 text-sm text-amber-100"
      >
        This policy has multiple policy contexts. Review and add the destination rule manually in the selected context.
      </p>
      <button
        v-else
        type="button"
        class="mt-4 rounded border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
        @click="emit('apply')"
      >
        Add suggested rule to draft
      </button>
      <p
        v-if="feedback"
        class="mt-3 text-sm text-green-100"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ feedback }}
      </p>
    </template>

    <p
      v-else
      class="mt-3 text-sm text-gray-200"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ unavailableMessage }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'PolicyCompatibilityProfilePurposeSuggestion',
})

const props = defineProps({
  suggestion: {
    type: Object,
    default: null,
  },
  selectedPresetCount: {
    type: Number,
    default: 0,
  },
  feedback: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  apply: () => true,
})

const profileSummary = computed(() => {
  const itemCount = props.suggestion?.profile?.itemCount
  const generatedAt = props.suggestion?.profile?.generatedAt
  const itemLabel = Number.isInteger(itemCount)
    ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
    : 'the current library profile'
  if (!generatedAt) return itemLabel

  const timestamp = new Date(generatedAt)
  return Number.isNaN(timestamp.getTime())
    ? itemLabel
    : `${itemLabel}, generated ${timestamp.toLocaleString()}`
})

const unavailableMessage = computed(() => ({
  profile_missing: 'Classifarr cannot offer a profile suggestion until this library has a current profile.',
  profile_stale: 'Classifarr will not offer a profile suggestion from a stale library profile. Refresh the profile before reviewing it.',
  profile_insufficient: 'The current library profile does not contain enough genre evidence to offer a safe starting rule.',
  policy_not_actionable: 'This policy does not currently need a profile-based purpose suggestion.',
  native_authority_active: 'This policy already has active native authority, so no compatibility suggestion is needed.',
}[props.suggestion?.statusId] || 'Classifarr could not safely prepare a profile-based purpose suggestion. You can still review the policy manually.'))
</script>
