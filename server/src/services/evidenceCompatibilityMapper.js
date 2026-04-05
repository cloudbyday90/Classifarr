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

/**
 * Legacy method values (matches classification_history.method constraint).
 * Kept as a frozen constant so callers can compare without string literals.
 */
const LEGACY_METHOD = Object.freeze({
  EXACT_MATCH:        'exact_match',
  LEARNED_PATTERN:    'learned_pattern',
  POLICY_AUTO:        'policy_auto',
  POLICY_CONFIRM:     'policy_confirm',
  AI_VERIFIED:        'ai_verified',
  MANUAL:             'manual_classification'
});

/**
 * Human-readable method labels for UI surfaces.
 * These match the labels used in History.vue / Activity.vue.
 */
const METHOD_LABELS = Object.freeze({
  [LEGACY_METHOD.EXACT_MATCH]:     'Exact Match',
  [LEGACY_METHOD.LEARNED_PATTERN]: 'Learned Pattern',
  [LEGACY_METHOD.POLICY_AUTO]:     'Policy Auto',
  [LEGACY_METHOD.POLICY_CONFIRM]:  'Policy Confirm',
  [LEGACY_METHOD.AI_VERIFIED]:     'AI Verified',
  [LEGACY_METHOD.MANUAL]:          'Manual Classification'
});

/**
 * Map a classification_evidence row to its legacy method string.
 *
 * Rules:
 *   scope=item_exact + provenance=human_confirmed  → exact_match
 *   scope=item_exact (any other provenance)         → exact_match  (item exact always maps to exact)
 *   scope=genre  + provenance=policy_confirmed      → learned_pattern
 *   scope=genre  + provenance=mined                 → learned_pattern (mined genre treated as learned)
 *   scope=studio|franchise|certification + mined    → learned_pattern
 *   all remaining                                   → policy_auto (fallback)
 *
 * @param {object} evidenceRow  - a row or DTO with { scope, provenance }
 * @returns {string}            - a LEGACY_METHOD value
 */
function toMethod(evidenceRow) {
  if (!evidenceRow) return LEGACY_METHOD.POLICY_AUTO;

  const { scope } = evidenceRow;

  if (scope === 'item_exact') return LEGACY_METHOD.EXACT_MATCH;

  if (scope === 'genre' || scope === 'studio' || scope === 'franchise' || scope === 'certification') {
    return LEGACY_METHOD.LEARNED_PATTERN;
  }

  return LEGACY_METHOD.POLICY_AUTO;
}

/**
 * Get the human-readable display label for a legacy method string.
 *
 * @param {string} method  - a LEGACY_METHOD key
 * @returns {string}        - display label (falls back to the raw method string)
 */
function toLabel(method) {
  return METHOD_LABELS[method] ?? method ?? 'Unknown';
}

/**
 * Map a classification_evidence row directly to a display label.
 * Convenience wrapper combining toMethod + toLabel.
 *
 * @param {object} evidenceRow  - a row or DTO with { scope, provenance }
 * @returns {string}
 */
function toMethodLabel(evidenceRow) {
  return toLabel(toMethod(evidenceRow));
}

/**
 * Determine whether a unified evidence row represents an authoritative result.
 * Only item_exact rows with human-confirmed provenance are authoritative.
 *
 * @param {object} evidenceRow  - a row or DTO with { scope, provenance }
 * @returns {boolean}
 */
function isAuthoritative(evidenceRow) {
  if (!evidenceRow) return false;
  return evidenceRow.scope === 'item_exact' && evidenceRow.provenance === 'human_confirmed';
}

/**
 * Build a minimal compatibility payload for a classification result.
 * Used by routes and stats surfaces that still need the legacy shape.
 *
 * @param {object}      evidenceRow   - winning evidence row (may be null)
 * @param {string|null} fallbackMethod - method from classification_history if no evidence row
 * @returns {{ method: string, methodLabel: string, isAuthoritative: boolean }}
 */
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
