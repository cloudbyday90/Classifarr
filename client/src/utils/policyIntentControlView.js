/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildPolicyIntentCertificationControlView } from '@/utils/policyIntentCertificationControl'
import { buildPolicyIntentGenreControlView } from '@/utils/policyIntentGenreControl'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

const CERTIFICATION_SECTION_KEYS = new Set([
  POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
  POLICY_INTENT_BUCKETS.EXCLUSIONS,
])

const GENRE_SECTION_KEYS = new Set([
  POLICY_INTENT_BUCKETS.IDENTITY,
  POLICY_INTENT_BUCKETS.COMPATIBILITY,
  POLICY_INTENT_BUCKETS.BOOSTERS,
])

export function buildPolicyIntentControlView(section = {}) {
  if (section?.controlKind === 'certification' || CERTIFICATION_SECTION_KEYS.has(section?.key)) {
    return buildPolicyIntentCertificationControlView(section)
  }

  if (section?.controlKind === 'genre_intent' || GENRE_SECTION_KEYS.has(section?.key)) {
    return buildPolicyIntentGenreControlView(section)
  }

  return {
    inputLabel: 'Intent option',
    buttonLabel: 'Add option',
    clearLabel: '',
    canClear: false,
  }
}
