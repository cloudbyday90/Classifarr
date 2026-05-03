/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * evidenceCompatibilityMapper.js
 *
 * Phase 3 compatibility adapter.
 *
 * Maps unified classification_evidence scope+provenance combinations back to
 * the legacy `method` values expected by history, stats, Discord, and client UI
 * surfaces. This is the single place to keep compatibility logic so it does not
 * scatter across routes, reporting, and discovery surfaces.
 *
 * Future work (Phase 6): once UI surfaces have been updated to use the unified
 * evidence model directly, this mapper can be retired.
 */

'use strict';

const LEGACY_METHOD = Object.freeze({
  EXACT_MATCH:        'exact_match',
  LEARNED_PATTERN:    'learned_pattern',
  POLICY_AUTO:        'policy_auto',
  POLICY_CONFIRM:     'policy_confirm',
  AI_VERIFIED:        'ai_verified',
  MANUAL:             'manual_classification'
});

const METHOD_LABELS = Object.freeze({
  [LEGACY_METHOD.EXACT_MATCH]:     'Exact Match',
  [LEGACY_METHOD.LEARNED_PATTERN]: 'Learned Pattern',
  [LEGACY_METHOD.POLICY_AUTO]:     'Policy Auto',
  [LEGACY_METHOD.POLICY_CONFIRM]:  'Policy Confirm',
  [LEGACY_METHOD.AI_VERIFIED]:     'AI Verified',
  [LEGACY_METHOD.MANUAL]:          'Manual Classification'
});

function toMethod(evidenceRow) {
  if (!evidenceRow) return LEGACY_METHOD.POLICY_AUTO;

  const { scope } = evidenceRow;

  if (scope === 'item_exact') return LEGACY_METHOD.EXACT_MATCH;

  if (scope === 'genre' || scope === 'studio' || scope === 'franchise' || scope === 'certification') {
    return LEGACY_METHOD.LEARNED_PATTERN;
  }

  return LEGACY_METHOD.POLICY_AUTO;
}

function toLabel(method) {
  return METHOD_LABELS[method] ?? method ?? 'Unknown';
}

function toMethodLabel(evidenceRow) {
  return toLabel(toMethod(evidenceRow));
}

function isAuthoritative(evidenceRow) {
  if (!evidenceRow) return false;
  return evidenceRow.scope === 'item_exact' && evidenceRow.provenance === 'human_confirmed';
}

function buildCompatibilityPayload(evidenceRow, fallbackMethod = null) {
  if (evidenceRow) {
    const method = toMethod(evidenceRow);
    return {
      method,
      methodLabel: toLabel(method),
      isAuthoritative: isAuthoritative(evidenceRow)
    };
  }

  const method = fallbackMethod ?? LEGACY_METHOD.POLICY_AUTO;
  return {
    method,
    methodLabel: toLabel(method),
    isAuthoritative: false
  };
}

module.exports = {
  LEGACY_METHOD,
  METHOD_LABELS,
  toMethod,
  toLabel,
  toMethodLabel,
  isAuthoritative,
  buildCompatibilityPayload
};
