/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const POLICY_REVIEW_TRIGGER_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'evidence_missing',
    label: 'Evidence is missing',
    help: 'Ask when Classifarr does not have enough evidence to automate safely.',
  }),
  Object.freeze({
    value: 'evidence_conflicting',
    label: 'Evidence conflicts',
    help: 'Ask when strong signals point to different destinations.',
  }),
  Object.freeze({
    value: 'profile_stale',
    label: 'Library profile is stale',
    help: 'Ask when the observed library profile needs refresh before automation.',
  }),
  Object.freeze({
    value: 'routing_not_ready',
    label: 'Routing is not ready',
    help: 'Ask when classification can be reviewed but the destination cannot route yet.',
  }),
])

function listPolicyReviewTriggerOptions() {
  return POLICY_REVIEW_TRIGGER_OPTIONS
}

function getPolicyReviewTriggerOption(value) {
  return POLICY_REVIEW_TRIGGER_OPTIONS.find(option => option.value === value) || null
}

export {
  POLICY_REVIEW_TRIGGER_OPTIONS,
  getPolicyReviewTriggerOption,
  listPolicyReviewTriggerOptions,
}
