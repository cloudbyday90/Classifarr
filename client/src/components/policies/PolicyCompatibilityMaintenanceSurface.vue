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
  >
    <header class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-amber-200">
        Existing policy
      </p>
      <h2
        id="policy-compatibility-maintenance-title"
        class="text-lg font-semibold text-white"
      >
        Compatibility policy maintenance
      </h2>
      <p class="text-sm text-gray-300">
        Maintain this policy's existing behavior while it remains on the compatibility model.
      </p>
      <p
        class="rounded border border-amber-700/50 bg-background/50 px-3 py-2 text-xs text-amber-100"
        role="status"
      >
        New policies use destination-first setup. This maintenance view does not establish native policy intent.
      </p>
    </header>

    <PolicyPresetMigrationNotice
      v-if="presetMigrationNotice"
      :notice="presetMigrationNotice"
      @dismiss="emit('dismiss-migration-notice')"
    />

    <PolicyIntentSummaryCard :summary="intentSummary" />

    <section
      id="policy-builder-intent-editor"
      aria-label="Compatibility policy intent editor"
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
    </section>

    <section
      id="policy-builder-advanced-settings"
      class="border-t border-amber-700/40 pt-5"
      aria-label="Compatibility policy settings"
    >
      <PolicyBuilderAdvancedSettings
        :form="form"
        :total-weight="totalWeight"
        @update-field="emit('update-field', $event)"
      />
    </section>
  </section>
</template>

<script setup>
import PolicyBuilderAdvancedSettings from '@/components/policies/PolicyBuilderAdvancedSettings.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyIntentSummaryCard from '@/components/policies/PolicyIntentSummaryCard.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'

defineProps({
  presetMigrationNotice: {
    type: Object,
    default: null,
  },
  intentSummary: {
    type: Object,
    required: true,
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
  form: {
    type: Object,
    required: true,
  },
  totalWeight: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits({
  'dismiss-migration-notice': () => true,
  'draft-add-signal': payload => Boolean(payload),
  'draft-remove-signal-value': payload => Boolean(payload),
  'draft-set-signal-config': payload => Boolean(payload),
  'draft-clear-signal-config': payload => Boolean(payload),
  'update-field': payload => Boolean(payload),
})
</script>
