<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <span
    class="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-sm text-xs"
    :class="badgeClass"
    :title="sourceHelp"
  >
    <span>{{ entry.displayText || entry.signal_type || 'Signal' }}</span>
    <span class="text-gray-400">({{ entry.preset_name || 'Selected template' }})</span>
    <span class="rounded-sm bg-black/20 px-1 text-[10px] uppercase tracking-wide text-gray-300">
      {{ sourceLabel }}
    </span>
    <button
      v-if="canEdit && entry.canRemove"
      type="button"
      class="ml-1 rounded-sm px-1 text-gray-300 hover:bg-black/20 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/60"
      :aria-label="entry.removeLabel || 'Remove signal'"
      @click="emit('remove-entry', entry)"
    >
      ×
    </button>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: {
    type: Object,
    required: true,
  },
  badgeClass: {
    type: String,
    default: '',
  },
  canEdit: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'remove-entry': entry => Boolean(entry),
})

const sourcePresentation = computed(() => {
  if (props.entry.provenance?.label) {
    return {
      label: props.entry.provenance.label,
      help: props.entry.provenance.help || 'Projected from policy intent view data.',
    }
  }

  if (props.entry.source === 'intent_draft') {
    return {
      label: 'Intent edit',
      help: 'Added or changed in the intent-first policy builder.',
    }
  }

  if (props.entry.source === 'legacy_custom_signals') {
    return {
      label: 'Policy override',
      help: 'Imported from existing policy-specific custom signals.',
    }
  }

  if (props.entry.source === 'legacy_preset') {
    return {
      label: 'Starter template',
      help: 'Inherited from the selected starter template.',
    }
  }

  return {
    label: 'Template signal',
    help: 'Projected from the selected template or compatibility policy data.',
  }
})

const sourceLabel = computed(() => sourcePresentation.value.label)
const sourceHelp = computed(() => sourcePresentation.value.help)
</script>
