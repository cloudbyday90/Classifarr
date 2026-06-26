/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, unref } from 'vue'

export function createEmptyCombinedSignals() {
  return {
    certifications: { include: [], exclude: [] },
    genres: { prefer: [], exclude: [], require_any: [] },
    keywords: { prefer: [], require_any: [], exclude: [] },
  }
}

const createSignalTrackers = () => ({
  certifications: { include: {}, exclude: {} },
  genres: { prefer: {}, exclude: {}, require_any: {} },
  keywords: { prefer: {}, require_any: {}, exclude: {} },
})

const formatTrackedSignals = (categoryMap) => {
  return Object.entries(categoryMap)
    .map(([value, sourcesSet]) => ({
      value,
      sources: Array.from(sourcesSet).sort(),
    }))
    .sort((left, right) => left.value.localeCompare(right.value))
}

const addTrackedSignal = (trackers, signalType, key, value, sourceName) => {
  if (!value || !trackers?.[signalType]?.[key]) {
    return
  }

  if (!trackers[signalType][key][value]) {
    trackers[signalType][key][value] = new Set()
  }
  trackers[signalType][key][value].add(sourceName)
}

const addSignalsForKey = ({ trackers, selectedPreset, fullPreset, signalType, key }) => {
  const baseItems = fullPreset?.signals?.[signalType]?.[key] || []
  const removedItems = selectedPreset?.customSignals?.removed?.[signalType]?.[key] || []
  const customItems = selectedPreset?.customSignals?.[signalType]?.[key] || []
  const sourceName = selectedPreset?.name || fullPreset?.name || 'Unknown'

  for (const item of baseItems) {
    if (!removedItems.includes(item)) {
      addTrackedSignal(trackers, signalType, key, item, sourceName)
    }
  }

  for (const item of customItems) {
    addTrackedSignal(trackers, signalType, key, item, sourceName)
  }
}

const signalKeys = [
  ['certifications', 'include'],
  ['certifications', 'exclude'],
  ['genres', 'prefer'],
  ['genres', 'exclude'],
  ['genres', 'require_any'],
  ['keywords', 'prefer'],
  ['keywords', 'require_any'],
  ['keywords', 'exclude'],
]

export function buildCombinedSignals(selectedPresets = [], allPresets = []) {
  if (!Array.isArray(selectedPresets) || selectedPresets.length === 0) {
    return createEmptyCombinedSignals()
  }

  const fullPresets = Array.isArray(allPresets) ? allPresets : []
  const trackers = createSignalTrackers()

  for (const selectedPreset of selectedPresets) {
    const fullPreset = fullPresets.find(preset =>
      preset.id === selectedPreset.id ||
      preset.id === selectedPreset.preset_id
    )

    if (!fullPreset?.signals) {
      continue
    }

    for (const [signalType, key] of signalKeys) {
      addSignalsForKey({
        trackers,
        selectedPreset,
        fullPreset,
        signalType,
        key,
      })
    }
  }

  return {
    certifications: {
      include: formatTrackedSignals(trackers.certifications.include),
      exclude: formatTrackedSignals(trackers.certifications.exclude),
    },
    genres: {
      prefer: formatTrackedSignals(trackers.genres.prefer),
      exclude: formatTrackedSignals(trackers.genres.exclude),
      require_any: formatTrackedSignals(trackers.genres.require_any),
    },
    keywords: {
      prefer: formatTrackedSignals(trackers.keywords.prefer),
      require_any: formatTrackedSignals(trackers.keywords.require_any),
      exclude: formatTrackedSignals(trackers.keywords.exclude),
    },
  }
}

export function usePolicyBuilderCombinedSignals({ selectedPresets, allPresets }) {
  const combinedSignals = computed(() => {
    return buildCombinedSignals(unref(selectedPresets), unref(allPresets))
  })

  return {
    combinedSignals,
  }
}
