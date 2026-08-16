/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MAX_PURPOSE_RULES = 100
const MAX_TERMS_PER_RULE = 50
const MAX_TERM_LENGTH = 120

export const NATIVE_PURPOSE_SIGNAL_TYPES = Object.freeze([
  { id: 'genres', label: 'Genres' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'studios', label: 'Studios' },
  { id: 'media_type', label: 'Media type' },
])

export const NATIVE_PURPOSE_OPERATORS = Object.freeze([
  { id: 'require_any', label: 'Requires any term' },
  { id: 'require_all', label: 'Requires every term' },
  { id: 'prefer', label: 'Prefers a matching term' },
  { id: 'include', label: 'Includes a matching term' },
  { id: 'exclude', label: 'Excludes a matching term' },
])

export const NATIVE_PURPOSE_SEMANTICS = Object.freeze([
  { id: 'identity', label: 'Destination identity' },
  { id: 'compatibility', label: 'Compatibility evidence' },
])

export const NATIVE_PURPOSE_CONSTRAINT_MODES = Object.freeze([
  { id: 'advisory', label: 'Advisory' },
  { id: 'strict', label: 'Strict' },
])

const SIGNAL_TYPE_IDS = new Set(NATIVE_PURPOSE_SIGNAL_TYPES.map(option => option.id))
const OPERATOR_VALUE_KEYS = Object.freeze({
  require_any: 'require_any',
  require_all: 'require_all',
  prefer: 'prefer',
  include: 'include',
  exclude: 'exclude',
})
const SEMANTICS_IDS = new Set(NATIVE_PURPOSE_SEMANTICS.map(option => option.id))
const CONSTRAINT_MODE_IDS = new Set(NATIVE_PURPOSE_CONSTRAINT_MODES.map(option => option.id))

function normalizeText(value) {
  if (typeof value !== 'string') return ''

  const withoutControlCharacters = [...value.normalize('NFKC')]
    .map(character => {
      const codePoint = character.codePointAt(0)
      return codePoint <= 0x1F || codePoint === 0x7F ? ' ' : character
    })
    .join('')

  return withoutControlCharacters
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNativePurposeTerms(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',')
  const terms = source
    .map(normalizeText)
    .filter(term => term && term.length <= MAX_TERM_LENGTH)

  return [...new Set(terms)].slice(0, MAX_TERMS_PER_RULE)
}

export function getNativePurposeOperatorValueKey(operator) {
  return OPERATOR_VALUE_KEYS[operator] || null
}

export function createNativePurposeRule() {
  return {
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: [] },
    constraint_mode: 'advisory',
    semantics: 'identity',
  }
}

function normalizeNativePurposeRule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const signalType = normalizeText(value.signal_type)
  const operator = normalizeText(value.operator)
  const valueKey = getNativePurposeOperatorValueKey(operator)
  const constraintMode = normalizeText(value.constraint_mode || 'advisory')
  const semantics = normalizeText(value.semantics || 'identity')
  const rawValues = value.values && typeof value.values === 'object' && !Array.isArray(value.values)
    ? value.values
    : null
  const terms = valueKey && rawValues ? parseNativePurposeTerms(rawValues[valueKey]) : []

  if (
    !SIGNAL_TYPE_IDS.has(signalType) ||
    !valueKey ||
    !CONSTRAINT_MODE_IDS.has(constraintMode) ||
    !SEMANTICS_IDS.has(semantics) ||
    terms.length === 0
  ) {
    return null
  }

  return {
    signal_type: signalType,
    operator,
    values: { [valueKey]: terms },
    constraint_mode: constraintMode,
    semantics,
  }
}

export function normalizeNativePurposeRules(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PURPOSE_RULES) return null

  const rules = value.map(normalizeNativePurposeRule)
  return rules.some(rule => rule === null) ? null : rules
}

export function buildNativeIntentPurposeChangeCommand(value) {
  const rules = normalizeNativePurposeRules(value)
  if (!rules) return null

  return {
    command_id: 'update_purpose',
    values: rules,
  }
}

export function cloneNativeIntentPurposeChangeRules(changeCommand) {
  const command = changeCommand && typeof changeCommand === 'object' ? changeCommand : {}
  if (command.command_id !== 'update_purpose') return null

  const rules = normalizeNativePurposeRules(command.values)
  return rules ? rules.map(rule => ({
    ...rule,
    values: { ...rule.values },
  })) : null
}
