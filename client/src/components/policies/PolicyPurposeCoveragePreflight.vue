<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-purpose-coverage-preflight"
    class="space-y-3 rounded-md border border-sky-800/70 bg-sky-950/20 p-4"
    aria-labelledby="policy-purpose-coverage-preflight-title"
  >
    <div class="space-y-1">
      <h3
        id="policy-purpose-coverage-preflight-title"
        class="text-sm font-semibold text-sky-100"
      >
        Check proposed purpose coverage
      </h3>
      <p class="text-sm text-gray-300">
        Review aggregate overlap before saving. This check does not retain the draft, expose policy terms,
        call AI, or change classification routing.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      :disabled="!available || loading"
      @click="emit('preflight')"
    >
      {{ loading ? 'Checking coverage...' : 'Check purpose coverage' }}
    </button>

    <p
      v-if="!available"
      class="text-sm text-gray-400"
    >
      Save this policy once before checking proposed purpose coverage.
    </p>

    <p
      v-if="error"
      class="text-sm text-red-300"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="preflight"
      class="space-y-3 rounded border border-sky-700/70 bg-gray-950/40 p-3"
      role="status"
    >
      <div>
        <p class="text-sm font-semibold text-white">
          {{ preflight.guidance?.title || 'Purpose coverage review complete' }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ preflight.guidance?.description }}
        </p>
      </div>

      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-gray-400">
            Required signals
          </dt>
          <dd class="font-medium text-white">
            {{ coverage.requiredSignalTypeCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Required terms
          </dt>
          <dd class="font-medium text-white">
            {{ coverage.requiredTermCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Unshared terms
          </dt>
          <dd class="font-medium text-white">
            {{ coverage.unsharedRequiredTermCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Shared terms
          </dt>
          <dd class="font-medium text-white">
            {{ coverage.sharedRequiredTermCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Overlapping destinations
          </dt>
          <dd class="font-medium text-white">
            {{ coverage.overlappingDestinationCount }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-400">
            Review status
          </dt>
          <dd class="font-medium text-white">
            {{ formatId(coverage.statusId) }}
          </dd>
        </div>
      </dl>

      <p class="text-xs text-gray-400">
        Advisory only. Saving remains subject to current server validation and authorization.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  preflight: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  available: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  preflight: () => true,
})

const coverage = computed(() => ({
  requiredSignalTypeCount: Number(props.preflight?.coverage?.requiredSignalTypeCount) || 0,
  requiredTermCount: Number(props.preflight?.coverage?.requiredTermCount) || 0,
  unsharedRequiredTermCount: Number(props.preflight?.coverage?.unsharedRequiredTermCount) || 0,
  sharedRequiredTermCount: Number(props.preflight?.coverage?.sharedRequiredTermCount) || 0,
  overlappingDestinationCount: Number(props.preflight?.coverage?.overlappingDestinationCount) || 0,
  statusId: props.preflight?.coverage?.statusId || 'not_available',
}))

function formatId(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}
</script>
