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

jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

const {
  LEGACY_METHOD,
  METHOD_LABELS,
  toMethod,
  toLabel,
  toMethodLabel,
  isAuthoritative,
  buildCompatibilityPayload
} = require('../services/evidenceCompatibilityMapper');

// ---------------------------------------------------------------------------
// LEGACY_METHOD / METHOD_LABELS constants
// ---------------------------------------------------------------------------

describe('LEGACY_METHOD', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(LEGACY_METHOD)).toBe(true);
  });

  test('contains all expected keys', () => {
    expect(LEGACY_METHOD.EXACT_MATCH).toBe('exact_match');
    expect(LEGACY_METHOD.LEARNED_PATTERN).toBe('learned_pattern');
    expect(LEGACY_METHOD.POLICY_AUTO).toBe('policy_auto');
    expect(LEGACY_METHOD.POLICY_CONFIRM).toBe('policy_confirm');
    expect(LEGACY_METHOD.AI_VERIFIED).toBe('ai_verified');
    expect(LEGACY_METHOD.MANUAL).toBe('manual_classification');
  });
});

describe('METHOD_LABELS', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(METHOD_LABELS)).toBe(true);
  });

  test('maps every LEGACY_METHOD value to a non-empty string', () => {
    for (const method of Object.values(LEGACY_METHOD)) {
      expect(typeof METHOD_LABELS[method]).toBe('string');
      expect(METHOD_LABELS[method].length).toBeGreaterThan(0);
    }
  });

  test('label for exact_match is "Exact Match"', () => {
    expect(METHOD_LABELS[LEGACY_METHOD.EXACT_MATCH]).toBe('Exact Match');
  });

  test('label for learned_pattern is "Learned Pattern"', () => {
    expect(METHOD_LABELS[LEGACY_METHOD.LEARNED_PATTERN]).toBe('Learned Pattern');
  });

  test('label for manual_classification is "Manual Classification"', () => {
    expect(METHOD_LABELS[LEGACY_METHOD.MANUAL]).toBe('Manual Classification');
  });
});

// ---------------------------------------------------------------------------
// toMethod
// ---------------------------------------------------------------------------

describe('toMethod', () => {
  test('returns policy_auto for null input', () => {
    expect(toMethod(null)).toBe(LEGACY_METHOD.POLICY_AUTO);
  });

  test('returns policy_auto for undefined input', () => {
    expect(toMethod(undefined)).toBe(LEGACY_METHOD.POLICY_AUTO);
  });

  // item_exact
  test('scope=item_exact + provenance=human_confirmed → exact_match', () => {
    expect(toMethod({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe(LEGACY_METHOD.EXACT_MATCH);
  });

  test('scope=item_exact + any other provenance → exact_match', () => {
    expect(toMethod({ scope: 'item_exact', provenance: 'mined' })).toBe(LEGACY_METHOD.EXACT_MATCH);
    expect(toMethod({ scope: 'item_exact', provenance: null })).toBe(LEGACY_METHOD.EXACT_MATCH);
  });

  // genre, studio, franchise, certification → learned_pattern
  test('scope=genre → learned_pattern', () => {
    expect(toMethod({ scope: 'genre', provenance: 'policy_confirmed' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  test('scope=genre + provenance=mined → learned_pattern', () => {
    expect(toMethod({ scope: 'genre', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  test('scope=studio + provenance=mined → learned_pattern', () => {
    expect(toMethod({ scope: 'studio', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  test('scope=franchise → learned_pattern', () => {
    expect(toMethod({ scope: 'franchise', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  test('scope=certification → learned_pattern', () => {
    expect(toMethod({ scope: 'certification', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  // fallback
  test('unknown scope → policy_auto (fallback)', () => {
    expect(toMethod({ scope: 'unknown_scope', provenance: 'anything' })).toBe(LEGACY_METHOD.POLICY_AUTO);
  });

  test('empty scope → policy_auto', () => {
    expect(toMethod({ scope: '', provenance: 'mined' })).toBe(LEGACY_METHOD.POLICY_AUTO);
  });

  test('missing scope key → policy_auto', () => {
    expect(toMethod({ provenance: 'mined' })).toBe(LEGACY_METHOD.POLICY_AUTO);
  });
});

// ---------------------------------------------------------------------------
// toLabel
// ---------------------------------------------------------------------------

describe('toLabel', () => {
  test('returns the human-readable label for a known method', () => {
    expect(toLabel(LEGACY_METHOD.EXACT_MATCH)).toBe('Exact Match');
    expect(toLabel(LEGACY_METHOD.LEARNED_PATTERN)).toBe('Learned Pattern');
    expect(toLabel(LEGACY_METHOD.POLICY_AUTO)).toBe('Policy Auto');
    expect(toLabel(LEGACY_METHOD.POLICY_CONFIRM)).toBe('Policy Confirm');
    expect(toLabel(LEGACY_METHOD.AI_VERIFIED)).toBe('AI Verified');
    expect(toLabel(LEGACY_METHOD.MANUAL)).toBe('Manual Classification');
  });

  test('falls back to the raw string for an unknown method', () => {
    expect(toLabel('custom_method')).toBe('custom_method');
  });

  test('falls back to "Unknown" for null', () => {
    expect(toLabel(null)).toBe('Unknown');
  });

  test('falls back to "Unknown" for undefined', () => {
    expect(toLabel(undefined)).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// toMethodLabel (convenience wrapper)
// ---------------------------------------------------------------------------

describe('toMethodLabel', () => {
  test('scope=item_exact → "Exact Match"', () => {
    expect(toMethodLabel({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe('Exact Match');
  });

  test('scope=genre → "Learned Pattern"', () => {
    expect(toMethodLabel({ scope: 'genre', provenance: 'mined' })).toBe('Learned Pattern');
  });

  test('unknown scope → "Policy Auto"', () => {
    expect(toMethodLabel({ scope: 'something_else' })).toBe('Policy Auto');
  });

  test('null input → "Policy Auto"', () => {
    expect(toMethodLabel(null)).toBe('Policy Auto');
  });
});

// ---------------------------------------------------------------------------
// isAuthoritative
// ---------------------------------------------------------------------------

describe('isAuthoritative', () => {
  test('returns true for scope=item_exact + provenance=human_confirmed', () => {
    expect(isAuthoritative({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe(true);
  });

  test('returns false for scope=item_exact + provenance=mined', () => {
    expect(isAuthoritative({ scope: 'item_exact', provenance: 'mined' })).toBe(false);
  });

  test('returns false for scope=item_exact + provenance=null', () => {
    expect(isAuthoritative({ scope: 'item_exact', provenance: null })).toBe(false);
  });

  test('returns false for scope=genre + provenance=human_confirmed', () => {
    expect(isAuthoritative({ scope: 'genre', provenance: 'human_confirmed' })).toBe(false);
  });

  test('returns false for scope=studio regardless of provenance', () => {
    expect(isAuthoritative({ scope: 'studio', provenance: 'human_confirmed' })).toBe(false);
    expect(isAuthoritative({ scope: 'studio', provenance: 'mined' })).toBe(false);
  });

  test('returns false for null input', () => {
    expect(isAuthoritative(null)).toBe(false);
  });

  test('returns false for undefined input', () => {
    expect(isAuthoritative(undefined)).toBe(false);
  });

  test('returns false when scope key is missing', () => {
    expect(isAuthoritative({ provenance: 'human_confirmed' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCompatibilityPayload
// ---------------------------------------------------------------------------

describe('buildCompatibilityPayload', () => {
  test('maps item_exact+human_confirmed evidence to exact_match authoritative payload', () => {
    const row = { scope: 'item_exact', provenance: 'human_confirmed' };
    const payload = buildCompatibilityPayload(row);
    expect(payload.method).toBe(LEGACY_METHOD.EXACT_MATCH);
    expect(payload.methodLabel).toBe('Exact Match');
    expect(payload.isAuthoritative).toBe(true);
  });

  test('maps item_exact+mined evidence to exact_match non-authoritative payload', () => {
    const row = { scope: 'item_exact', provenance: 'mined' };
    const payload = buildCompatibilityPayload(row);
    expect(payload.method).toBe(LEGACY_METHOD.EXACT_MATCH);
    expect(payload.isAuthoritative).toBe(false);
  });

  test('maps genre evidence to learned_pattern payload', () => {
    const row = { scope: 'genre', provenance: 'policy_confirmed' };
    const payload = buildCompatibilityPayload(row);
    expect(payload.method).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    expect(payload.methodLabel).toBe('Learned Pattern');
    expect(payload.isAuthoritative).toBe(false);
  });

  test('falls back to fallbackMethod when evidenceRow is null', () => {
    const payload = buildCompatibilityPayload(null, LEGACY_METHOD.MANUAL);
    expect(payload.method).toBe(LEGACY_METHOD.MANUAL);
    expect(payload.methodLabel).toBe('Manual Classification');
    expect(payload.isAuthoritative).toBe(false);
  });

  test('falls back to policy_auto when evidenceRow is null and no fallbackMethod', () => {
    const payload = buildCompatibilityPayload(null);
    expect(payload.method).toBe(LEGACY_METHOD.POLICY_AUTO);
    expect(payload.methodLabel).toBe('Policy Auto');
    expect(payload.isAuthoritative).toBe(false);
  });

  test('falls back to policy_auto when evidenceRow is null and fallbackMethod is null', () => {
    const payload = buildCompatibilityPayload(null, null);
    expect(payload.method).toBe(LEGACY_METHOD.POLICY_AUTO);
  });

  test('ignores fallbackMethod when evidenceRow is provided', () => {
    const row = { scope: 'genre', provenance: 'mined' };
    const payload = buildCompatibilityPayload(row, LEGACY_METHOD.MANUAL);
    expect(payload.method).toBe(LEGACY_METHOD.LEARNED_PATTERN);
  });

  test('payload always has exactly method, methodLabel, isAuthoritative keys', () => {
    const payload = buildCompatibilityPayload({ scope: 'studio', provenance: 'mined' });
    expect(Object.keys(payload).sort()).toEqual(['isAuthoritative', 'method', 'methodLabel']);
  });

  test('fallback path also has exactly the three expected keys', () => {
    const payload = buildCompatibilityPayload(null);
    expect(Object.keys(payload).sort()).toEqual(['isAuthoritative', 'method', 'methodLabel']);
  });

  test('methodLabel in fallback path is derived from the fallback method', () => {
    const payload = buildCompatibilityPayload(null, LEGACY_METHOD.AI_VERIFIED);
    expect(payload.methodLabel).toBe('AI Verified');
  });

  test('methodLabel falls back to raw string for unrecognised fallbackMethod', () => {
    const payload = buildCompatibilityPayload(null, 'legacy_custom');
    expect(payload.methodLabel).toBe('legacy_custom');
  });
});
