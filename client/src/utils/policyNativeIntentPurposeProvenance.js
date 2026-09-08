/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const NATIVE_INTENT_PURPOSE_PROVENANCE_IDS = Object.freeze({
  DECLARED_NATIVE: 'declared_native',
  PROFILE_DERIVED: 'profile_derived',
  MIXED: 'mixed',
  UNVERIFIED: 'unverified',
})

const KNOWN_PROVENANCE_IDS = new Set(Object.values(NATIVE_INTENT_PURPOSE_PROVENANCE_IDS))

function hasOnlyKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...keys].sort()
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
}

export function normalizeNativeIntentPurposeProvenance(value) {
  if (!hasOnlyKeys(value, ['id', 'declarationRequired', 'rawRuleProvenanceExposed'])) return null
  if (!KNOWN_PROVENANCE_IDS.has(value.id) || value.rawRuleProvenanceExposed !== false) return null

  const declarationRequired = value.id !== NATIVE_INTENT_PURPOSE_PROVENANCE_IDS.DECLARED_NATIVE
  if (value.declarationRequired !== declarationRequired) return null

  return Object.freeze({
    id: value.id,
    declarationRequired,
    rawRuleProvenanceExposed: false,
  })
}

export function getNativeIntentPurposeProvenancePresentation(value) {
  const provenance = normalizeNativeIntentPurposeProvenance(value)
  if (!provenance) return null

  switch (provenance.id) {
    case NATIVE_INTENT_PURPOSE_PROVENANCE_IDS.DECLARED_NATIVE:
      return Object.freeze({
        ...provenance,
        title: 'Declared native purpose',
        description: 'The stored purpose is already recorded as a native declaration. You may revise it when needed.',
        startLabel: 'Change declared purpose',
        applyLabel: 'Apply purpose change',
        editingDescription: 'Review every rule below. Applying replaces this revision\'s purpose collection and creates the next native revision.',
      })
    case NATIVE_INTENT_PURPOSE_PROVENANCE_IDS.PROFILE_DERIVED:
      return Object.freeze({
        ...provenance,
        title: 'Profile-derived terms require review',
        description: 'These stored terms are descriptive evidence from a library profile. They are not declared purpose until an administrator reviews and records a new native revision.',
        startLabel: 'Review and declare purpose',
        applyLabel: 'Declare reviewed purpose',
        editingDescription: 'Review every rule below. Declaring them creates the next native revision; the passive lifecycle scheduler will reassess aggregate study eligibility without selecting a cohort or routing media.',
      })
    case NATIVE_INTENT_PURPOSE_PROVENANCE_IDS.MIXED:
      return Object.freeze({
        ...provenance,
        title: 'Mixed purpose provenance requires review',
        description: 'The stored purpose includes more than one provenance class. Review every term before recording a single new native declaration.',
        startLabel: 'Review purpose provenance',
        applyLabel: 'Record reviewed purpose',
        editingDescription: 'Review every rule below. Applying replaces this revision\'s purpose collection and creates the next native revision.',
      })
    default:
      return Object.freeze({
        ...provenance,
        title: 'Purpose provenance requires review',
        description: 'Classifarr cannot verify a complete native declaration for the stored purpose. Review every term before recording a new native declaration.',
        startLabel: 'Review purpose provenance',
        applyLabel: 'Record reviewed purpose',
        editingDescription: 'Review every rule below. Applying replaces this revision\'s purpose collection and creates the next native revision.',
      })
  }
}
