<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border p-4 space-y-3"
    :class="cardClass"
    aria-label="Policy intent impact preview"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 class="font-semibold flex items-center gap-2">
          <span
            class="text-primary"
            aria-hidden="true"
          >
            🔎
          </span>
          Intent Impact Preview
        </h4>
        <p class="text-xs opacity-80 mt-1 max-w-2xl">
          Compare the current intent draft against the legacy preset path before
          saving. Preview is read-only and does not change policy storage.
        </p>
      </div>

      <Button
        variant="secondary"
        size="sm"
        :disabled="disabled || loading"
        @click="emit('preview')"
      >
        {{ loading ? 'Previewing...' : actionLabel }}
      </Button>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-red-700/70 bg-red-950/30 p-3 text-sm text-red-100"
      role="alert"
    >
      {{ error }}
    </div>

    <div
      v-else-if="notice"
      role="status"
      aria-live="polite"
      class="space-y-2"
    >
      <div>
        <div class="font-semibold">
          {{ notice.title }}
        </div>
        <p class="text-sm opacity-90">
          {{ notice.message }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-full border border-current/30 px-2 py-1">
          Parity: {{ parityLabel }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          Impact: {{ impactLabel }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          Legacy templates: {{ preview.legacy.preset_count }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          Draft templates: {{ preview.native_draft.preset_count }}
        </span>
      </div>

      <div
        v-if="changedBuckets.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <div
          v-for="bucket in changedBuckets"
          :key="bucket.bucket"
          class="rounded-md border border-current/20 bg-black/10 p-2 text-xs"
        >
          <div class="font-semibold">
            {{ bucket.label }}
          </div>
          <div class="opacity-80">
            Legacy {{ bucket.legacy_count }} → Draft {{ bucket.native_count }}
          </div>
          <div class="opacity-70">
            +{{ bucket.added_signals }} / -{{ bucket.removed_signals }} signals
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="rounded-md border border-gray-700 bg-background-light p-3 text-sm text-gray-300"
    >
      No preview has been run for this draft yet.
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  preview: {
    type: Object,
    default: null,
  },
  notice: {
    type: Object,
    default: null,
  },
  changedBuckets: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
})

const emit = defineEmits({
  preview: () => true,
})

const actionLabel = computed(() => props.preview ? 'Refresh Preview' : 'Preview Impact')

const cardClass = computed(() => {
  const tone = props.notice?.tone
  if (props.error || tone === 'error') return 'border-red-700/70 bg-red-950/20 text-red-100'
  if (tone === 'warning') return 'border-amber-700/70 bg-amber-950/20 text-amber-100'
  if (tone === 'success') return 'border-green-800/70 bg-green-950/20 text-green-100'
  return 'border-blue-800/70 bg-blue-950/20 text-blue-100'
})

const parityLabel = computed(() => props.preview?.comparison?.parity || 'unavailable')
const impactLabel = computed(() => props.preview?.comparison?.impact_level || 'unknown')
</script>
