/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function createEmptyView(presetCount = 0) {
  return {
    [POLICY_INTENT_BUCKETS.IDENTITY]: [],
    [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [],
    [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [],
    [POLICY_INTENT_BUCKETS.BOOSTERS]: [],
    [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [],
    summary: {
      preset_count: presetCount,
      counts: {},
    },
  }
}

function normalizeEntry(entry, draftPreset, bucket) {
  return {
    role: bucket,
    preset_id: draftPreset?.preset_id ?? null,
    preset_name: draftPreset?.preset_name || 'Selected preset',
    signal_type: entry?.signal_type,
    semantics: entry?.metadata?.semantics || (bucket === POLICY_INTENT_BUCKETS.COMPATIBILITY ? 'compatibility' : 'identity'),
    constraint_mode: entry?.metadata?.constraint_mode || (bucket === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS ? 'strict' : 'advisory'),
    values: asObject(entry?.values),
    source: entry?.source || draftPreset?.source || 'intent_draft',
  }
}

export function buildPolicyIntentViewFromDraft(intentDraft = null) {
  const draft = asObject(intentDraft)
  const presets = Array.isArray(draft.presets) ? draft.presets : []
  const view = createEmptyView(presets.length)

  for (const draftPreset of presets) {
    const buckets = asObject(draftPreset?.buckets)
    for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
      const entries = Array.isArray(buckets[bucket]) ? buckets[bucket] : []
      view[bucket].push(...entries.map(entry => normalizeEntry(entry, draftPreset, bucket)))
    }
  }

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    view.summary.counts[bucket] = view[bucket].length
  }

  return view
}
