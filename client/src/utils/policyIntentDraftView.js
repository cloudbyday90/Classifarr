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

export const POLICY_INTENT_DRAFT_VIEW_PROVENANCE = Object.freeze({
  OPERATOR_EDIT: 'operator_edit',
  STARTER_TEMPLATE: 'starter_template',
  COMPATIBILITY_FALLBACK: 'compatibility_fallback',
  OBSERVED_EVIDENCE_SUGGESTION: 'observed_evidence_suggestion',
  SERVER_PROJECTION: 'server_projection',
})

const SOURCE_PROVENANCE = Object.freeze({
  intent_draft: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.OPERATOR_EDIT,
    label: 'Intent edit',
    help: 'Added or changed in the intent-first policy builder.',
  },
  legacy_preset: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.STARTER_TEMPLATE,
    label: 'Starter template',
    help: 'Inherited from the selected starter template.',
  },
  legacy_custom_signals: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.COMPATIBILITY_FALLBACK,
    label: 'Policy override',
    help: 'Imported from existing policy-specific compatibility data.',
  },
  compatibility_fallback: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.COMPATIBILITY_FALLBACK,
    label: 'Policy override',
    help: 'Imported from existing policy-specific compatibility data.',
  },
  observed_evidence_suggestion: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.OBSERVED_EVIDENCE_SUGGESTION,
    label: 'Observed suggestion',
    help: 'Suggested from media-server evidence and not saved until an operator applies it.',
  },
  server_projection: {
    id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.SERVER_PROJECTION,
    label: 'Server projection',
    help: 'Read-only server projection; it is not draft intent by itself.',
  },
})

const DEFAULT_PROVENANCE = SOURCE_PROVENANCE.legacy_preset

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function createReadOnlyPlaceholder(status = 'not_loaded', items = []) {
  return {
    status,
    read_only: true,
    items: asArray(items),
  }
}

function createEmptyView(presetCount = 0, options = {}) {
  return {
    [POLICY_INTENT_BUCKETS.IDENTITY]: [],
    [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [],
    [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [],
    [POLICY_INTENT_BUCKETS.BOOSTERS]: [],
    [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [],
    [POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]: [],
    summary: {
      preset_count: presetCount,
      counts: {},
      provenance_counts: {},
      warnings: [],
      readiness: createReadOnlyPlaceholder(options.readiness?.status, options.readiness?.items),
      observed_evidence: createReadOnlyPlaceholder(options.observedEvidence?.status, options.observedEvidence?.items),
    },
  }
}

function resolveProvenance(source) {
  return SOURCE_PROVENANCE[source] || DEFAULT_PROVENANCE
}

function normalizeDisplayValues(values) {
  return Object.entries(asObject(values)).flatMap(([key, rawValue]) => {
    const candidates = Array.isArray(rawValue) ? rawValue : [rawValue]
    return candidates
      .filter(value => value !== undefined && value !== null && String(value).trim().length > 0)
      .map(value => ({
        key,
        value,
      }))
  })
}

function normalizeEntry(entry, draftPreset, bucket) {
  const source = entry?.source || draftPreset?.source || 'intent_draft'
  const provenance = resolveProvenance(source)
  const values = asObject(entry?.values)

  return {
    role: bucket,
    preset_id: draftPreset?.preset_id ?? null,
    preset_name: draftPreset?.preset_name || 'Selected preset',
    signal_type: entry?.signal_type,
    semantics: entry?.metadata?.semantics || (bucket === POLICY_INTENT_BUCKETS.COMPATIBILITY ? 'compatibility' : 'identity'),
    constraint_mode: entry?.metadata?.constraint_mode || (bucket === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS ? 'strict' : 'advisory'),
    values,
    display_values: normalizeDisplayValues(values),
    source,
    provenance,
    warnings: [],
  }
}

function countProvenance(view, entry) {
  const provenanceId = entry?.provenance?.id || POLICY_INTENT_DRAFT_VIEW_PROVENANCE.STARTER_TEMPLATE
  view.summary.provenance_counts[provenanceId] = (view.summary.provenance_counts[provenanceId] || 0) + 1
}

export function buildPolicyIntentViewFromDraft(intentDraft = null, options = {}) {
  const draft = asObject(intentDraft)
  const presets = Array.isArray(draft.presets) ? draft.presets : []
  const view = createEmptyView(presets.length, options)

  for (const draftPreset of presets) {
    const buckets = asObject(draftPreset?.buckets)
    for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
      const entries = Array.isArray(buckets[bucket]) ? buckets[bucket] : []
      for (const entry of entries) {
        const normalizedEntry = normalizeEntry(entry, draftPreset, bucket)
        view[bucket].push(normalizedEntry)
        countProvenance(view, normalizedEntry)
      }
    }
  }

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    view.summary.counts[bucket] = view[bucket].length
  }

  return view
}
