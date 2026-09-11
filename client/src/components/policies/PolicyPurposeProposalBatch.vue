<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="proposal || loading"
    class="border-b border-gray-700 bg-background/50 p-5"
    aria-labelledby="policy-purpose-proposal-batch-heading"
  >
    <h3
      id="policy-purpose-proposal-batch-heading"
      class="text-base font-semibold text-white"
    >
      Purpose setup
    </h3>
    <p
      class="mt-1 max-w-3xl text-sm leading-6 text-gray-300"
      role="status"
      aria-live="polite"
    >
      {{ description }}
    </p>

    <div
      v-if="loading && !proposal"
      class="mt-3 text-sm text-gray-400"
      role="status"
      aria-live="polite"
    >
      Checking current purpose setup…
    </div>

    <template v-else-if="proposal">
      <div
        v-if="canApply"
        class="mt-4 flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          class="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="applying"
          @click="emit('apply')"
        >
          {{ applying ? 'Applying purpose setup…' : `Apply ${candidateCount} reviewed purpose${candidateCount === 1 ? '' : 's'}` }}
        </button>
        <span class="text-sm text-gray-400">Applies all compatible drafts together, or none.</span>
      </div>

      <p
        v-if="actionError"
        class="mt-4 rounded border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-100"
        role="alert"
      >
        {{ actionError }}
      </p>

      <details
        v-if="candidateCount > 0"
        class="mt-4 rounded border border-gray-700 bg-background/40 p-3 text-sm"
      >
        <summary class="cursor-pointer font-medium text-gray-100">
          Review {{ candidateCount }} compatible {{ candidateCount === 1 ? 'library' : 'libraries' }}
        </summary>
        <ul class="mt-3 space-y-2 text-gray-300">
          <li
            v-for="entry in candidates"
            :key="entry.policy.id"
          >
            <span class="font-medium text-white">{{ entry.policy.name }}</span>
            <span> · {{ entry.library.name }}<template v-if="entry.library.mediaType"> · {{ entry.library.mediaType }}</template></span>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  proposal: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  applying: { type: Boolean, default: false },
  actionError: { type: String, default: '' },
})

const emit = defineEmits({ apply: () => true })

const candidates = computed(() => (
  Array.isArray(props.proposal?.candidates) ? props.proposal.candidates : []
))
const candidateCount = computed(() => Number(props.proposal?.summary?.candidatePolicyCount) || candidates.value.length)
const exceptionCount = computed(() => Number(props.proposal?.summary?.exceptionPolicyCount) || 0)
const canApply = computed(() => (
  props.proposal?.statusId === 'ready_for_apply' &&
  props.proposal?.action?.available === true &&
  candidateCount.value > 0
))
const description = computed(() => {
  if (props.loading && !props.proposal) return 'Checking the current server-derived purpose setup.'
  if (canApply.value) {
    const exceptionText = exceptionCount.value > 0
      ? ` ${exceptionCount.value} ${exceptionCount.value === 1 ? 'policy needs' : 'policies need'} individual review.`
      : ''
    return `${candidateCount.value} profile-derived purpose ${candidateCount.value === 1 ? 'draft is' : 'drafts are'} ready to apply together.${exceptionText} No AI or RAG call is made.`
  }
  if (props.proposal?.statusId === 'review_window_truncated') {
    return 'There are more purpose drafts than this safe review window can cover. No bulk action is available; narrow the active policies or use individual review.'
  }
  if (props.proposal?.statusId === 'individual_review_required') {
    return 'The remaining purpose drafts have mixed or unverified provenance and need individual review.'
  }
  return 'No compatible profile-derived purpose drafts are ready to apply.'
})
</script>
