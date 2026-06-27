<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="rounded-lg border border-gray-700 bg-background-light p-3 space-y-3">
    <div>
      <div class="text-sm font-semibold text-white">
        {{ section.label }}
      </div>
      <p class="text-xs text-gray-400">
        {{ section.help }}
      </p>
      <p
        v-if="section.behaviorSummary"
        class="mt-2 rounded-md border border-gray-700 bg-background px-2 py-1 text-xs text-gray-300"
      >
        {{ section.behaviorSummary }}
      </p>
      <div
        v-if="section.warnings?.length"
        class="mt-2 space-y-1"
      >
        <p
          v-for="warning in section.warnings"
          :key="warning.code"
          class="rounded-md border px-2 py-1 text-xs"
          :class="warningClass(warning)"
        >
          {{ warning.message }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-1">
      <PolicyIntentChip
        v-for="entry in section.entries"
        :key="entryKey(entry)"
        :entry="entry"
        :badge-class="section.badgeClass"
        :can-edit="canEdit"
        @remove-entry="emitRemoveEntry"
      />
      <span
        v-if="section.entries.length === 0"
        class="text-xs text-gray-500"
      >
        No configured signals.
      </span>
    </div>

    <div
      v-if="canEdit"
      class="space-y-2"
    >
      <div>
        <div class="text-xs font-medium text-gray-300">
          {{ section.actionLabel }}
        </div>
        <p class="text-[11px] text-gray-500">
          {{ section.actionHelp }}
        </p>
      </div>

      <PolicyIntentCertificationControl
        v-if="section.controlKind === 'certification'"
        :section="section"
        @add-value="payload => emit('add-value', payload)"
        @clear-section="sectionKey => emit('clear-section', sectionKey)"
      />

      <PolicyIntentGenreControl
        v-else-if="section.controlKind === 'genre_intent'"
        :section="section"
        @add-value="payload => emit('add-value', payload)"
      />

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2"
      >
        <select
          class="px-2 py-1 bg-background border border-gray-700 rounded-sm text-xs"
          @change="emitAddValue"
        >
          <option value="">
            {{ section.addLabel }}
          </option>
          <option
            v-for="option in section.options"
            :key="section.key + '-' + option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
        <button
          v-if="section.hasClearAction"
          type="button"
          class="px-2 py-1 border border-gray-600 rounded-sm text-xs text-gray-300 hover:bg-gray-700"
          @click="emit('clear-section', section.key)"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import PolicyIntentChip from '@/components/policies/PolicyIntentChip.vue'
import PolicyIntentCertificationControl from '@/components/policies/PolicyIntentCertificationControl.vue'
import PolicyIntentGenreControl from '@/components/policies/PolicyIntentGenreControl.vue'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
  canEdit: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
  'clear-section': sectionKey => typeof sectionKey === 'string' && sectionKey.length > 0,
  'remove-entry': payload => Boolean(payload?.sectionKey && payload?.entry),
})

const emitAddValue = (event) => {
  const value = event.target.value
  event.target.value = ''
  if (!value) return

  emit('add-value', {
    sectionKey: props.section.key,
    value,
  })
}

const warningClass = (warning = {}) => {
  if (warning.severity === 'warning') {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
  }

  return 'border-blue-800/70 bg-blue-950/30 text-blue-200'
}

const entryKey = (entry) => {
  return [
    entry.role,
    entry.preset_id,
    entry.signal_type,
    JSON.stringify(entry.values),
  ].join(':')
}

const emitRemoveEntry = (entry) => {
  emit('remove-entry', {
    sectionKey: props.section.key,
    entry,
  })
}

</script>
