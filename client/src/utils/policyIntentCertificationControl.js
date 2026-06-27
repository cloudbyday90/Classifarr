/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

export function buildPolicyIntentCertificationControlView(section = {}) {
  const isHardLimit = section?.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS

  return {
    isHardLimit,
    inputLabel: isHardLimit ? 'Maximum allowed rating' : 'Rating to avoid',
    buttonLabel: isHardLimit ? 'Set max rating' : 'Add avoid rating',
    clearLabel: 'Clear max rating',
    canClear: Boolean(section?.hasClearAction),
  }
}
