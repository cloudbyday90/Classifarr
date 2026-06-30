/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function buildPolicyIntentSectionWarnings(sectionKey, sectionEntries = [], sectionMap = {}) {
  const entries = asArray(sectionEntries)
  const identityEntries = asArray(sectionMap[POLICY_INTENT_BUCKETS.IDENTITY])
  const strictEntries = asArray(sectionMap[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS])

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY && entries.length === 0) {
    return [{
      code: 'missing_identity',
      severity: 'warning',
      message: 'Add at least one belongs-here signal so this policy has a clear destination identity.',
      consequence: 'Without identity evidence, broad hints and RAG neighbors are more likely to force manual review.',
    }]
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY && entries.length > 0 && identityEntries.length === 0) {
    return [{
      code: 'compatibility_without_identity',
      severity: 'warning',
      message: 'Helpful matches cannot decide alone. Add a belongs-here signal.',
      consequence: 'Helpful evidence can support a destination, but it should not be the strongest reason to classify there.',
    }]
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS && entries.length === 0) {
    return [{
      code: 'missing_hard_limit',
      severity: 'info',
      message: 'No hard limit configured. Add a max rating when this library needs rating boundaries.',
      consequence: 'Without a hard limit, mature or unrated items rely on weaker evidence before review is triggered.',
    }]
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS && entries.length > 0 && identityEntries.length === 0) {
    return [{
      code: 'boosters_without_identity',
      severity: 'warning',
      message: 'Boosts need belongs-here evidence before they should raise confidence.',
      consequence: 'Boosts should improve confidence after a fit is established, not create the fit by themselves.',
    }]
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS && entries.length === 0 && strictEntries.length === 0) {
    return [{
      code: 'missing_exclusions',
      severity: 'info',
      message: 'No avoid ratings configured. Add one when specific ratings should count against this destination.',
      consequence: 'Avoid ratings help Classifarr lower confidence before an item reaches the wrong destination.',
    }]
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS && entries.length === 0) {
    return [{
      code: 'missing_review_triggers',
      severity: 'info',
      message: 'No review triggers configured. Classifarr will still ask when readiness is unsafe.',
      consequence: 'Explicit review triggers make it clearer when automation should stop and ask.',
    }]
  }

  return []
}

export function buildPolicyIntentSectionCompletion(sectionKey, sectionEntries = [], warnings = []) {
  const entries = asArray(sectionEntries)
  const sectionWarnings = asArray(warnings)
  const blockingWarning = sectionWarnings.find(warning => warning.severity === 'warning')
  const advisoryWarning = sectionWarnings.find(warning => warning.severity !== 'warning')

  if (blockingWarning?.code === 'missing_identity') {
    return {
      status: 'needs_identity',
      tone: 'warning',
      label: 'Needs identity',
      description: 'Add a belongs-here signal before relying on this policy.',
    }
  }

  if (blockingWarning?.code === 'compatibility_without_identity' || blockingWarning?.code === 'boosters_without_identity') {
    return {
      status: 'needs_identity',
      tone: 'warning',
      label: 'Needs identity',
      description: 'Supporting signals need belongs-here evidence first.',
    }
  }

  if (blockingWarning) {
    return {
      status: 'needs_review',
      tone: 'warning',
      label: 'Needs review',
      description: 'Review this section before relying on this policy.',
    }
  }

  if (advisoryWarning) {
    return {
      status: 'advisory',
      tone: 'info',
      label: 'Advisory',
      description: 'This section has an optional safety improvement.',
    }
  }

  if (entries.length > 0) {
    return {
      status: 'configured',
      tone: 'success',
      label: 'Configured',
      description: 'This section has configured intent signals.',
    }
  }

  return {
    status: 'optional',
    tone: 'neutral',
    label: 'Optional',
    description: 'This section can be left empty for this policy.',
  }
}

export function buildPolicyIntentSectionNextAction(sectionKey, completion = {}) {
  if (completion.status === 'needs_identity') {
    return 'Next: add a belongs-here genre that clearly defines this destination.'
  }

  if (completion.status === 'needs_review') {
    return 'Next: review this section before depending on the policy outcome.'
  }

  if (completion.status === 'advisory') {
    if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
      return 'Next: add a maximum rating if this library needs a hard maturity boundary.'
    }

    if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
      return 'Next: add avoid ratings if specific certifications should reduce confidence.'
    }

    return 'Next: review the advisory note when tightening this policy.'
  }

  if (completion.status === 'configured') {
    if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY) {
      return 'Next: add helpful matches only if they support this identity without replacing it.'
    }

    if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
      return 'Next: add avoid ratings only for ratings that should actively reduce confidence.'
    }

    return 'Next: leave this section as-is unless the library intent needs more detail.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    return 'Next: add boosts only for signals that should raise confidence after a fit is established.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    return 'Next: add helpful matches only after the destination identity is clear.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return 'Next: add avoid ratings only when this destination should reject or down-rank specific ratings.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS) {
    return 'Next: add review triggers for uncertainty that should stop automation.'
  }

  return 'Next: no action required unless this section should shape classification.'
}

export function buildPolicyIntentReadinessSummary(sections = []) {
  const issues = asArray(sections).flatMap((section) => {
    return asArray(section?.warnings).map(warning => ({
      ...warning,
      sectionKey: section.key,
      sectionLabel: section.label,
    }))
  })
  const warningCount = issues.filter(issue => issue.severity === 'warning').length
  const infoCount = issues.filter(issue => issue.severity !== 'warning').length

  if (warningCount > 0) {
    return {
      status: 'needs_review',
      tone: 'warning',
      label: 'Needs review',
      message: `${warningCount} structural warning${warningCount === 1 ? '' : 's'} should be reviewed before relying on this policy.`,
      warningCount,
      infoCount,
      issues,
    }
  }

  if (infoCount > 0) {
    return {
      status: 'ready_with_notes',
      tone: 'info',
      label: 'Ready with notes',
      message: `${infoCount} advisory note${infoCount === 1 ? '' : 's'} can improve routing safety, but this policy has no structural warnings.`,
      warningCount,
      infoCount,
      issues,
    }
  }

  return {
    status: 'ready',
    tone: 'success',
    label: 'Ready',
    message: 'This policy has clear destination identity and no weak-section warnings.',
    warningCount,
    infoCount,
    issues,
  }
}
