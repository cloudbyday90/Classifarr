/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'

const POLICY_INTENT_EDITOR_GROUP_IDS = Object.freeze({
  REVIEW_BEHAVIOR: 'review_behavior',
  DESTINATION_IDENTITY: 'destination_identity',
  DESTINATION_RULES: 'destination_rules',
  CONFIDENCE_SUPPORT: 'confidence_support',
})

const POLICY_INTENT_EDITOR_GROUP_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR,
    title: 'When should Classifarr ask?',
    help: 'Review readiness before editing details. Classifarr should ask when evidence, intent, or freshness is not safe enough to automate.',
    targetId: 'policy-builder-review-behavior',
    sectionKeys: Object.freeze([
      POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS,
    ]),
  }),
  Object.freeze({
    id: POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_IDENTITY,
    title: 'What clearly belongs here?',
    help: 'Accept destination identity from observed examples or explicit operator intent.',
    targetId: 'policy-builder-destination-identity',
    sectionKeys: Object.freeze([
      POLICY_INTENT_BUCKETS.IDENTITY,
    ]),
  }),
  Object.freeze({
    id: POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_RULES,
    title: 'What should always or never belong here?',
    help: 'Set helpful matches, hard limits, and avoid values as explicit destination rules.',
    targetId: 'policy-builder-destination-rules',
    sectionKeys: Object.freeze([
      POLICY_INTENT_BUCKETS.COMPATIBILITY,
      POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      POLICY_INTENT_BUCKETS.EXCLUSIONS,
    ]),
  }),
  Object.freeze({
    id: POLICY_INTENT_EDITOR_GROUP_IDS.CONFIDENCE_SUPPORT,
    title: 'What helps after fit is clear?',
    help: 'Use boosts only after the item already fits this destination.',
    targetId: 'policy-builder-confidence-support',
    sectionKeys: Object.freeze([
      POLICY_INTENT_BUCKETS.BOOSTERS,
    ]),
  }),
])

function buildPolicyIntentEditorGroups(sections = []) {
  const sectionByKey = new Map(sections.map(section => [section.key, section]))

  return POLICY_INTENT_EDITOR_GROUP_DEFINITIONS.map(group => ({
    ...group,
    sections: group.sectionKeys
      .map(sectionKey => sectionByKey.get(sectionKey))
      .filter(Boolean),
  }))
}

export {
  POLICY_INTENT_EDITOR_GROUP_DEFINITIONS,
  POLICY_INTENT_EDITOR_GROUP_IDS,
  buildPolicyIntentEditorGroups,
}
