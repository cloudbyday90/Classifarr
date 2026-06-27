<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="border-t border-gray-700 p-3 space-y-3 text-xs">
    <div>
      <label class="font-medium text-gray-300 block mb-1">Content Ratings:</label>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="cert in getPresetBaseSignals(preset, 'certifications', 'include')"
          :key="'base-inc-' + cert"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
          :class="{ 'opacity-40 line-through': isSignalRemoved(preset, 'certifications', 'include', cert) }"
        >
          {{ cert }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          <button
            v-if="!isSignalRemoved(preset, 'certifications', 'include', cert)"
            class="hover:text-red-400"
            title="Remove"
            @click="emitSignalRemoval('certifications', 'include', cert, true)"
          >×</button>
          <button
            v-else
            class="hover:text-green-400"
            title="Restore"
            @click="emitSignalRemoval('certifications', 'include', cert, false)"
          >↩</button>
        </span>

        <span
          v-for="cert in getCustomSignalList('certifications', 'include')"
          :key="'cust-inc-' + cert"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
        >
          + {{ cert }}
          <button
            class="hover:text-red-400"
            @click="emitRemoveCustomSignal('certifications', 'include', cert)"
          >×</button>
        </span>

        <select
          class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
          @change="handleSelectSignal('certifications', $event)"
        >
          <option value="">
            + Add
          </option>
          <optgroup label="Include">
            <option
              v-for="rating in availableRatings"
              :key="'inc-' + rating"
              :value="'include:' + rating"
            >
              ✓ {{ rating }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <div>
      <label class="font-medium text-gray-300 block mb-1">Genres:</label>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="genre in getPresetBaseSignals(preset, 'genres', 'prefer')"
          :key="'base-pref-' + genre"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
          :class="{ 'opacity-40 line-through': isSignalRemoved(preset, 'genres', 'prefer', genre) }"
        >
          {{ genre }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          <button
            v-if="!isSignalRemoved(preset, 'genres', 'prefer', genre)"
            class="hover:text-red-400"
            title="Remove"
            @click="emitSignalRemoval('genres', 'prefer', genre, true)"
          >×</button>
          <button
            v-else
            class="hover:text-green-400"
            title="Restore"
            @click="emitSignalRemoval('genres', 'prefer', genre, false)"
          >↩</button>
        </span>

        <span
          v-for="genre in getPresetBaseSignals(preset, 'genres', 'exclude')"
          :key="'base-exc-' + genre"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
          :class="{ 'opacity-40 line-through': isSignalRemoved(preset, 'genres', 'exclude', genre) }"
        >
          ✕ {{ genre }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          <button
            v-if="!isSignalRemoved(preset, 'genres', 'exclude', genre)"
            class="hover:text-white"
            title="Remove"
            @click="emitSignalRemoval('genres', 'exclude', genre, true)"
          >×</button>
          <button
            v-else
            class="hover:text-green-400"
            title="Restore"
            @click="emitSignalRemoval('genres', 'exclude', genre, false)"
          >↩</button>
        </span>

        <span
          v-for="genre in getCustomSignalList('genres', 'prefer')"
          :key="'cust-pref-' + genre"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
        >
          + {{ genre }}
          <button
            class="hover:text-red-400"
            @click="emitRemoveCustomSignal('genres', 'prefer', genre)"
          >×</button>
        </span>

        <select
          class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
          @change="handleSelectSignal('genres', $event)"
        >
          <option value="">
            + Add
          </option>
          <optgroup label="Prefer">
            <option
              v-for="genre in availableGenres"
              :key="'pref-' + genre"
              :value="'prefer:' + genre"
            >
              ✓ {{ genre }}
            </option>
          </optgroup>
          <optgroup label="Exclude">
            <option
              v-for="genre in availableGenres"
              :key="'exc-' + genre"
              :value="'exclude:' + genre"
            >
              ✕ {{ genre }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <div>
      <label class="font-medium text-gray-300 block mb-1">Keywords:</label>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="keyword in getPresetBaseSignals(preset, 'keywords', 'exclude')"
          :key="'base-exc-' + keyword"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
          :class="{ 'opacity-40 line-through': isSignalRemoved(preset, 'keywords', 'exclude', keyword) }"
        >
          ✕ {{ keyword }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          <button
            v-if="!isSignalRemoved(preset, 'keywords', 'exclude', keyword)"
            class="hover:text-white"
            title="Remove"
            @click="emitSignalRemoval('keywords', 'exclude', keyword, true)"
          >×</button>
          <button
            v-else
            class="hover:text-green-400"
            title="Restore"
            @click="emitSignalRemoval('keywords', 'exclude', keyword, false)"
          >↩</button>
        </span>

        <span
          v-for="keyword in getCustomSignalList('keywords', 'require_any')"
          :key="'cust-req-' + keyword"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
        >
          + {{ keyword }}
          <button
            class="hover:text-red-400"
            @click="emitRemoveCustomSignal('keywords', 'require_any', keyword)"
          >×</button>
        </span>

        <input
          v-model="newKeyword"
          type="text"
          placeholder="+ keyword (Enter)"
          class="w-32 px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
          @keydown.enter="emitKeyword"
        >
      </div>
    </div>

    <div v-if="hasPresetLanguageSignals(preset)">
      <label class="font-medium text-gray-300 block mb-1">Language / Regional:</label>
      <div class="space-y-2">
        <div class="flex flex-wrap gap-1">
          <span
            v-for="lang in getPresetBaseSignals(preset, 'language', 'require_any')"
            :key="'base-lang-req-' + lang"
            class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
          >
            {{ formatLanguageCode(lang) }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          </span>
          <span
            v-for="lang in getPresetBaseSignals(preset, 'language', 'exclude')"
            :key="'base-lang-exc-' + lang"
            class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
          >
            ✕ {{ formatLanguageCode(lang) }} <span class="text-gray-500 text-xs">({{ preset.name }})</span>
          </span>
          <span
            v-for="lang in getCustomSignalList('language', 'require_any')"
            :key="'cust-lang-req-' + lang"
            class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
          >
            + {{ formatLanguageCode(lang) }}
            <button
              class="hover:text-red-400"
              @click="emitRemoveCustomSignal('language', 'require_any', lang)"
            >×</button>
          </span>
          <span
            v-for="lang in getCustomSignalList('language', 'exclude')"
            :key="'cust-lang-exc-' + lang"
            class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
          >
            + exclude {{ formatLanguageCode(lang) }}
            <button
              class="hover:text-white"
              @click="emitRemoveCustomSignal('language', 'exclude', lang)"
            >×</button>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-gray-400">Runtime mode:</span>
          <button
            class="px-2 py-1 rounded-sm border transition-colors"
            :class="getPresetSignalStrict(preset, 'language') ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-primary text-primary bg-primary/10'"
            @click="emitSignalStrict(false)"
          >
            Advisory
          </button>
          <button
            class="px-2 py-1 rounded-sm border transition-colors"
            :class="getPresetSignalStrict(preset, 'language') ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-gray-600 text-gray-400 hover:bg-gray-700'"
            @click="emitSignalStrict(true)"
          >
            Strict
          </button>
        </div>
        <p class="text-[11px] text-gray-500">
          {{ getPresetRuntimeSummary(preset) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  formatLanguageCode,
  usePolicyBuilderTemplateSignals,
} from '@/composables/usePolicyBuilderTemplateSignals'

const props = defineProps({
  preset: {
    type: Object,
    required: true,
  },
  allPresets: {
    type: Array,
    default: () => [],
  },
  availableRatings: {
    type: Array,
    default: () => [],
  },
  availableGenres: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'add-custom-signal',
  'remove-custom-signal',
  'set-signal-removal',
  'set-signal-strict',
])

const allPresetsRef = computed(() => props.allPresets)
const newKeyword = ref('')

const {
  getPresetBaseSignals,
  hasPresetLanguageSignals,
  getPresetRuntimeSummary,
  getPresetSignalStrict,
  isSignalRemoved,
} = usePolicyBuilderTemplateSignals({
  allPresets: allPresetsRef,
})

const getCustomSignalList = (signalType, key) => {
  return props.preset?.customSignals?.[signalType]?.[key] || []
}

const emitAddCustomSignal = (signalType, key, value) => {
  if (!signalType || !key || !value) return
  emit('add-custom-signal', {
    preset: props.preset,
    signalType,
    key,
    value,
  })
}

const emitRemoveCustomSignal = (signalType, key, value) => {
  if (!signalType || !key || !value) return
  emit('remove-custom-signal', {
    preset: props.preset,
    signalType,
    key,
    value,
  })
}

const emitSignalRemoval = (signalType, key, value, removed) => {
  emit('set-signal-removal', {
    preset: props.preset,
    signalType,
    key,
    value,
    removed,
  })
}

const emitSignalStrict = (strict) => {
  emit('set-signal-strict', {
    preset: props.preset,
    signalType: 'language',
    strict,
  })
}

const handleSelectSignal = (signalType, event) => {
  const rawValue = event?.target?.value || ''
  if (event?.target) event.target.value = ''

  const [key, ...valueParts] = rawValue.split(':')
  emitAddCustomSignal(signalType, key, valueParts.join(':'))
}

const emitKeyword = () => {
  const keyword = newKeyword.value.trim().toLowerCase()
  if (!keyword) return

  newKeyword.value = ''
  emitAddCustomSignal('keywords', 'require_any', keyword)
}
</script>
