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
    </div>

    <div class="flex flex-wrap gap-1">
      <span
        v-for="entry in section.entries"
        :key="entryKey(entry)"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs"
        :class="section.badgeClass"
      >
        {{ entry.displayText || entry.signal_type || 'Signal' }}
        <span class="text-gray-400">({{ entry.preset_name }})</span>
        <button
          v-if="canEdit && entry.canRemove"
          type="button"
          class="ml-1 rounded-sm px-1 text-gray-300 hover:bg-black/20 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/60"
          :aria-label="entry.removeLabel || 'Remove signal'"
          @click="emitRemoveEntry(entry)"
        >
          ×
        </button>
      </span>
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

      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
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
