/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

const GENRE_CONTROL_VIEWS = {
  [POLICY_INTENT_BUCKETS.IDENTITY]: {
    inputLabel: 'Genre that defines this library',
    buttonLabel: 'Add belongs-here genre',
  },
  [POLICY_INTENT_BUCKETS.COMPATIBILITY]: {
    inputLabel: 'Genre that can support a match',
    buttonLabel: 'Add helpful genre',
  },
  [POLICY_INTENT_BUCKETS.BOOSTERS]: {
    inputLabel: 'Genre that boosts confidence',
    buttonLabel: 'Add confidence boost',
  },
}

export function buildPolicyIntentGenreControlView(section = {}) {
  return GENRE_CONTROL_VIEWS[section?.key] || {
    inputLabel: 'Genre signal',
    buttonLabel: 'Add genre',
  }
}
