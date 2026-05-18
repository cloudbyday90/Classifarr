/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildTargetedRecheckDiagnostic } from './ragLoopUi'

const CONTRACT_VIOLATION_LINES = {
  narrative_no_format_match: 'AI contract issue: classify response came back as free-form text instead of the required CONFIDENT or CLARIFY format.',
  no_format_matched: 'AI contract issue: classify response did not match the required CONFIDENT or CLARIFY format.',
  single_valid_option: 'AI contract issue: clarify response mapped to only one valid library option.',
  no_valid_options: 'AI contract issue: clarify response did not map to any valid library options.',
}

export function policyQuestion(item) {
  const value = item?.policy_question
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function policyOptions(item) {
  const question = policyQuestion(item)
  return question && Array.isArray(question.options) ? question.options.filter(Boolean) : []
}

export function primaryPolicyOption(item) {
  const options = policyOptions(item)
  if (!options.length) return null
  return options.find(option => Number.isFinite(Number(option.library_id))) || options[0]
}

export function suggestedLibraryLabel(item) {
  const option = primaryPolicyOption(item)
  return item.library_name || item.suggested_library_name || option?.library_name || null
}

export function parserContractDiagnosticLine(item) {
  const meta = policyQuestion(item)?.meta
  const violationReason = typeof meta?.violation_reason === 'string'
    ? meta.violation_reason.trim()
    : ''
  const isContractViolation = item?.pending_reason === 'AI response contract violation' || Boolean(violationReason)

  if (!isContractViolation) return null
  return CONTRACT_VIOLATION_LINES[violationReason] || 'AI contract issue: classify response could not be validated against the required response format.'
}

export function primaryNeedsAttentionReason(item) {
  return parserContractDiagnosticLine(item) || item?.pending_reason || null
}

export function targetedRecheckLine(item) {
  return buildTargetedRecheckDiagnostic(item?.metadata, item?.confidence) || null
}

export function binaryPolicyOptions(item) {
  const options = policyOptions(item)
  if (options.length !== 2) return null

  const out = { yes: null, no: null }
  for (const option of options) {
    const text = `${option.label || ''} ${String(option.value ?? '')}`.toLowerCase()
    const raw = String(option.value ?? '').toLowerCase()

    if (raw === 'true' || raw === 'yes' || /\byes\b/.test(text) || /\bconfirm\b/.test(text) || /\bapprove\b/.test(text)) {
      out.yes = option
    } else if (raw === 'false' || raw === 'no' || /\bno\b/.test(text) || /\breject\b/.test(text) || /\bdecline\b/.test(text)) {
      out.no = option
    }
  }

  return out.yes && out.no ? out : null
}
