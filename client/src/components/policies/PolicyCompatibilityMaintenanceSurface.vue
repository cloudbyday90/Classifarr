<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    id="policy-compatibility-maintenance"
    class="space-y-5 rounded-lg border border-amber-700/50 bg-amber-950/10 p-4"
    aria-labelledby="policy-compatibility-maintenance-title"
    aria-describedby="policy-compatibility-maintenance-description"
  >
    <header class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-amber-200">
        Existing policy
      </p>
      <h2
        id="policy-compatibility-maintenance-title"
        class="text-lg font-semibold text-white"
      >
        Maintain existing policy
      </h2>
      <p
        id="policy-compatibility-maintenance-description"
        class="text-sm text-gray-300"
      >
        Choose a policy context, then make only the destination changes you need.
      </p>
    </header>

    <PolicyPresetMigrationNotice
      v-if="presetMigrationNotice"
      :notice="presetMigrationNotice"
      @dismiss="emit('dismiss-migration-notice')"
    />

    <div
      id="policy-builder-intent-editor"
    >
      <PolicyIntentEditor
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :intent-draft="intentDraft"
        :available-genres="availableGenres"
        :available-genre-options="availableGenreOptions"
        :available-ratings="availableRatings"
        @draft-add-signal="emit('draft-add-signal', $event)"
        @draft-remove-signal-value="emit('draft-remove-signal-value', $event)"
        @draft-set-signal-config="emit('draft-set-signal-config', $event)"
        @draft-clear-signal-config="emit('draft-clear-signal-config', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'

defineProps({
  presetMigrationNotice: {
    type: Object,
    default: null,
  },
  selectedPresets: {
    type: Array,
    default: () => [],
  },
  allPresets: {
    type: Array,
    default: () => [],
  },
  intentDraft: {
    type: Object,
    default: null,
  },
  availableGenres: {
    type: Array,
    default: () => [],
  },
  availableGenreOptions: {
    type: Array,
    default: () => [],
  },
  availableRatings: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  'dismiss-migration-notice': () => true,
  'draft-add-signal': payload => Boolean(payload),
  'draft-remove-signal-value': payload => Boolean(payload),
  'draft-set-signal-config': payload => Boolean(payload),
  'draft-clear-signal-config': payload => Boolean(payload),
})
</script>
