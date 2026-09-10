/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  addNativePurposeBootstrapTerms,
  buildNativePurposeBootstrapGroups,
  isNativePurposeBootstrapEligible,
  updateNativePurposeBootstrapSelection,
} from '@/utils/policyNativeIntentPurposeBootstrap'

function command(rules) {
  return { command_id: 'update_purpose', values: rules }
}

function purposeRule({
  signalType = 'genres',
  operator = 'require_any',
  terms = ['Comedy'],
  semantics = 'identity',
  constraintMode = 'advisory',
} = {}) {
  return {
    signal_type: signalType,
    operator,
    values: { [operator]: terms },
    constraint_mode: constraintMode,
    semantics,
  }
}

describe('policyNativeIntentPurposeBootstrap', () => {
  it('separates observed suggestions from selected declaration terms', () => {
    const suggestionCommand = command([purposeRule({ terms: ['Comedy', 'Documentary'] })])
    const groups = buildNativePurposeBootstrapGroups({
      suggestionCommand,
      selectedRules: [purposeRule({ terms: ['Comedy'] })],
    })

    expect(groups).toEqual([expect.objectContaining({
      signalType: 'genres',
      terms: [
        { value: 'Comedy', selected: true, observed: true },
        { value: 'Documentary', selected: false, observed: true },
      ],
    })])
  })

  it('keeps advanced rules out of the compact bootstrap rather than simplifying them', () => {
    expect(isNativePurposeBootstrapEligible(command([
      purposeRule({ operator: 'exclude' }),
    ]))).toBe(false)
    expect(isNativePurposeBootstrapEligible(command([
      purposeRule({ constraintMode: 'strict' }),
    ]))).toBe(false)
  })

  it('removes an observed term only from the local purpose draft', () => {
    const suggestionCommand = command([purposeRule({ terms: ['Comedy', 'Documentary'] })])
    const updated = updateNativePurposeBootstrapSelection({
      suggestionCommand,
      selectedRules: [purposeRule({ terms: ['Comedy', 'Documentary'] })],
      groupId: 'genres:require_any:identity:advisory',
      term: 'Documentary',
      selected: false,
    })

    expect(updated).toEqual([purposeRule({ terms: ['Comedy'] })])
    expect(suggestionCommand.values[0].values.require_any).toEqual(['Comedy', 'Documentary'])
  })

  it('adds normalized operator-entered terms to the selected local draft', () => {
    const suggestionCommand = command([purposeRule({ terms: ['Comedy'] })])
    const updated = addNativePurposeBootstrapTerms({
      suggestionCommand,
      selectedRules: [purposeRule({ terms: ['Comedy'] })],
      groupId: 'genres:require_any:identity:advisory',
      terms: 'Stand-up, Comedy',
    })

    expect(updated).toEqual([purposeRule({ terms: ['Comedy', 'Stand-up'] })])
  })
})
