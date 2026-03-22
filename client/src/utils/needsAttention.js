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
