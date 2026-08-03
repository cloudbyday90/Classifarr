/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function clonePolicyIntentDraftForWrite(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(draft))
  } catch {
    return null
  }
}

export function normalizePolicyIntentWritePreflight(preflight) {
  const value = asObject(preflight)
  if (value.present !== true) {
    return null
  }

  const validation = asObject(value.validation)
  const presetCount = Number(value.preset_count)

  return {
    present: true,
    validation: {
      valid: validation.valid === true,
      errors: Array.isArray(validation.errors) ? validation.errors : [],
    },
    persistence_enabled: value.persistence_enabled === true,
    persistence_reason_code: typeof value.persistence_reason_code === 'string'
      ? value.persistence_reason_code
      : 'legacy_draft_sidecar_not_persisted',
    draft_schema_version: Number(value.draft_schema_version) || null,
    source: typeof value.source === 'string' ? value.source : 'unknown',
    migration_state: typeof value.migration_state === 'string' ? value.migration_state : 'unknown',
    preset_count: Number.isFinite(presetCount) ? presetCount : 0,
  }
}

export function buildPolicyIntentWritePreflightNotice(preflight) {
  const normalized = normalizePolicyIntentWritePreflight(preflight)
  if (!normalized) {
    return null
  }

  const templateCountLabel = `${normalized.preset_count} starter template${
    normalized.preset_count === 1 ? '' : 's'
  }`

  if (!normalized.validation.valid) {
    return {
      tone: 'error',
      title: 'Intent draft validation failed',
      message: 'The server rejected the policy intent draft before saving.',
    }
  }

  if (!normalized.persistence_enabled) {
    return {
      tone: 'info',
      title: 'Compatibility save confirmed',
      message: `The server validated ${templateCountLabel} as an intent draft but did not store that draft as native authority. The policy was saved through the legacy-compatible preset path.`,
    }
  }

  return {
    tone: 'success',
    title: 'Intent draft saved',
    message: `The server validated and persisted ${templateCountLabel} as native intent.`,
  }
}
