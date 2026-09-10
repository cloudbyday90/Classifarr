/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  cloneNativeIntentPurposeChangeRules,
  getNativePurposeOperatorValueKey,
  normalizeNativePurposeRules,
  parseNativePurposeTerms,
} from './policyNativeIntentPurposeChange'

const BOOTSTRAP_SIGNAL_TYPE_IDS = new Set(['genres', 'keywords', 'studios'])

function ruleTerms(rule) {
  const valueKey = getNativePurposeOperatorValueKey(rule?.operator)
  return valueKey ? parseNativePurposeTerms(rule?.values?.[valueKey]) : []
}

function isBootstrapRule(rule) {
  return BOOTSTRAP_SIGNAL_TYPE_IDS.has(rule?.signal_type) &&
    rule?.operator === 'require_any' &&
    rule?.semantics === 'identity' &&
    rule?.constraint_mode === 'advisory'
}

function ruleGroupId(rule) {
  return [
    rule?.signal_type,
    rule?.operator,
    rule?.semantics,
    rule?.constraint_mode,
  ].join(':')
}

function cloneRulesForDraft(value) {
  if (!Array.isArray(value)) return null
  if (value.length === 0) return []

  const normalized = normalizeNativePurposeRules(value)
  return normalized ? normalized.map(rule => ({
    ...rule,
    values: { ...rule.values },
  })) : null
}

function createRuleFromGroup(group, terms) {
  return {
    signal_type: group.signalType,
    operator: 'require_any',
    values: { require_any: terms },
    constraint_mode: 'advisory',
    semantics: 'identity',
  }
}

function buildTermMap(rules) {
  const termsByGroup = new Map()
  for (const rule of rules) {
    if (!isBootstrapRule(rule)) continue

    const id = ruleGroupId(rule)
    const terms = termsByGroup.get(id) || []
    for (const term of ruleTerms(rule)) {
      if (!terms.includes(term)) terms.push(term)
    }
    termsByGroup.set(id, terms)
  }
  return termsByGroup
}

function normalizeSuggestedRules(suggestionCommand) {
  return cloneNativeIntentPurposeChangeRules(suggestionCommand)
}

/**
 * Returns whether a server-owned purpose command can be represented as the
 * compact identity-purpose bootstrap. Unsupported rules stay available through
 * the established advanced editor and are never simplified implicitly.
 */
export function isNativePurposeBootstrapEligible(suggestionCommand) {
  const rules = normalizeSuggestedRules(suggestionCommand)
  return Array.isArray(rules) && rules.length > 0 && rules.every(isBootstrapRule)
}

/**
 * Builds a display-safe, selection-oriented view of observed terms. The
 * suggestions remain separate from the selected draft so existing contents do
 * not become declared purpose merely by being displayed.
 */
export function buildNativePurposeBootstrapGroups({
  suggestionCommand,
  selectedRules = [],
} = {}) {
  const suggestedRules = normalizeSuggestedRules(suggestionCommand)
  const normalizedSelectedRules = cloneRulesForDraft(selectedRules)
  if (!suggestedRules || normalizedSelectedRules === null || !suggestedRules.every(isBootstrapRule)) {
    return null
  }

  const suggestedTerms = buildTermMap(suggestedRules)
  const selectedTerms = buildTermMap(normalizedSelectedRules)
  const groups = []

  for (const rule of [...suggestedRules, ...normalizedSelectedRules]) {
    if (!isBootstrapRule(rule)) continue
    const id = ruleGroupId(rule)
    if (groups.some(group => group.id === id)) continue

    const terms = [
      ...(suggestedTerms.get(id) || []),
      ...(selectedTerms.get(id) || []).filter(term => !(suggestedTerms.get(id) || []).includes(term)),
    ]
    groups.push(Object.freeze({
      id,
      signalType: rule.signal_type,
      terms: Object.freeze(terms.map(term => Object.freeze({
        value: term,
        selected: (selectedTerms.get(id) || []).includes(term),
        observed: (suggestedTerms.get(id) || []).includes(term),
      }))),
    }))
  }

  return Object.freeze(groups)
}

/**
 * Selects or removes one compact-bootstrap term without altering any advanced
 * rule that the compact surface does not own.
 */
export function updateNativePurposeBootstrapSelection({
  suggestionCommand,
  selectedRules = [],
  groupId,
  term,
  selected,
} = {}) {
  const groups = buildNativePurposeBootstrapGroups({ suggestionCommand, selectedRules })
  const normalizedSelectedRules = cloneRulesForDraft(selectedRules)
  if (!groups || normalizedSelectedRules === null || typeof selected !== 'boolean') return null

  const group = groups.find(candidate => candidate.id === groupId)
  const normalizedTerm = parseNativePurposeTerms([term])
  if (!group || normalizedTerm.length !== 1) return null

  const currentTerms = normalizedSelectedRules
    .filter(rule => ruleGroupId(rule) === group.id)
    .flatMap(ruleTerms)
  const nextTerms = selected
    ? [...new Set([...currentTerms, normalizedTerm[0]])]
    : currentTerms.filter(value => value !== normalizedTerm[0])
  const retainedRules = normalizedSelectedRules.filter(rule => ruleGroupId(rule) !== group.id)

  return nextTerms.length > 0
    ? [...retainedRules, createRuleFromGroup(group, nextTerms)]
    : retainedRules
}

/**
 * Adds bounded operator-entered terms to a compact identity-purpose group.
 * They remain a local draft until the existing server-validated writer commits
 * a revision.
 */
export function addNativePurposeBootstrapTerms({
  suggestionCommand,
  selectedRules = [],
  groupId,
  terms,
} = {}) {
  const groups = buildNativePurposeBootstrapGroups({ suggestionCommand, selectedRules })
  const normalizedSelectedRules = cloneRulesForDraft(selectedRules)
  const additions = parseNativePurposeTerms(terms)
  if (!groups || normalizedSelectedRules === null || additions.length === 0) return null

  const group = groups.find(candidate => candidate.id === groupId)
  if (!group) return null

  const currentTerms = normalizedSelectedRules
    .filter(rule => ruleGroupId(rule) === group.id)
    .flatMap(ruleTerms)
  const retainedRules = normalizedSelectedRules.filter(rule => ruleGroupId(rule) !== group.id)

  return [
    ...retainedRules,
    createRuleFromGroup(group, [...new Set([...currentTerms, ...additions])]),
  ]
}
