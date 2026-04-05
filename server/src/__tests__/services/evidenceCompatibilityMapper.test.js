/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for evidenceCompatibilityMapper
 */

'use strict';

const {
  LEGACY_METHOD,
  METHOD_LABELS,
  toMethod,
  toLabel,
  toMethodLabel,
  isAuthoritative,
  buildCompatibilityPayload
} = require('../../services/evidenceCompatibilityMapper');

describe('evidenceCompatibilityMapper', () => {

  // ── toMethod ───────────────────────────────────────────────────────────────

  describe('toMethod', () => {
    test('null/undefined returns policy_auto', () => {
      expect(toMethod(null)).toBe(LEGACY_METHOD.POLICY_AUTO);
      expect(toMethod(undefined)).toBe(LEGACY_METHOD.POLICY_AUTO);
    });

    test('item_exact → exact_match regardless of provenance', () => {
      expect(toMethod({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe(LEGACY_METHOD.EXACT_MATCH);
      expect(toMethod({ scope: 'item_exact', provenance: 'mined' })).toBe(LEGACY_METHOD.EXACT_MATCH);
    });

    test('genre → learned_pattern', () => {
      expect(toMethod({ scope: 'genre', provenance: 'policy_confirmed' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
      expect(toMethod({ scope: 'genre', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    });

    test('studio → learned_pattern', () => {
      expect(toMethod({ scope: 'studio', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    });

    test('franchise → learned_pattern', () => {
      expect(toMethod({ scope: 'franchise', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    });

    test('certification → learned_pattern', () => {
      expect(toMethod({ scope: 'certification', provenance: 'mined' })).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    });

    test('unknown scope falls back to policy_auto', () => {
      expect(toMethod({ scope: 'keyword', provenance: 'mined' })).toBe(LEGACY_METHOD.POLICY_AUTO);
      expect(toMethod({ scope: undefined, provenance: 'mined' })).toBe(LEGACY_METHOD.POLICY_AUTO);
    });
  });

  // ── toLabel ────────────────────────────────────────────────────────────────

  describe('toLabel', () => {
    test('returns human label for each known method', () => {
      expect(toLabel(LEGACY_METHOD.EXACT_MATCH)).toBe('Exact Match');
      expect(toLabel(LEGACY_METHOD.LEARNED_PATTERN)).toBe('Learned Pattern');
      expect(toLabel(LEGACY_METHOD.POLICY_AUTO)).toBe('Policy Auto');
      expect(toLabel(LEGACY_METHOD.MANUAL)).toBe('Manual Classification');
    });

    test('falls back to raw method string for unknown values', () => {
      expect(toLabel('custom_method')).toBe('custom_method');
    });

    test('falls back to "Unknown" for null/undefined', () => {
      expect(toLabel(null)).toBe('Unknown');
      expect(toLabel(undefined)).toBe('Unknown');
    });
  });

  // ── toMethodLabel ──────────────────────────────────────────────────────────

  describe('toMethodLabel', () => {
    test('item_exact + human_confirmed → "Exact Match"', () => {
      expect(toMethodLabel({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe('Exact Match');
    });

    test('genre + mined → "Learned Pattern"', () => {
      expect(toMethodLabel({ scope: 'genre', provenance: 'mined' })).toBe('Learned Pattern');
    });
  });

  // ── isAuthoritative ────────────────────────────────────────────────────────

  describe('isAuthoritative', () => {
    test('null returns false', () => {
      expect(isAuthoritative(null)).toBe(false);
    });

    test('item_exact + human_confirmed → true', () => {
      expect(isAuthoritative({ scope: 'item_exact', provenance: 'human_confirmed' })).toBe(true);
    });

    test('item_exact + mined → false (not human confirmed)', () => {
      expect(isAuthoritative({ scope: 'item_exact', provenance: 'mined' })).toBe(false);
    });

    test('genre + human_confirmed → false (not item_exact)', () => {
      expect(isAuthoritative({ scope: 'genre', provenance: 'human_confirmed' })).toBe(false);
    });
  });

  // ── buildCompatibilityPayload ──────────────────────────────────────────────

  describe('buildCompatibilityPayload', () => {
    test('uses evidence row when provided', () => {
      const row = { scope: 'item_exact', provenance: 'human_confirmed' };
      const payload = buildCompatibilityPayload(row);
      expect(payload.method).toBe(LEGACY_METHOD.EXACT_MATCH);
      expect(payload.methodLabel).toBe('Exact Match');
      expect(payload.isAuthoritative).toBe(true);
    });

    test('falls back to fallbackMethod when no evidence row', () => {
      const payload = buildCompatibilityPayload(null, 'learned_pattern');
      expect(payload.method).toBe('learned_pattern');
      expect(payload.methodLabel).toBe('Learned Pattern');
      expect(payload.isAuthoritative).toBe(false);
    });

    test('defaults to policy_auto when no evidence row and no fallback', () => {
      const payload = buildCompatibilityPayload(null);
      expect(payload.method).toBe(LEGACY_METHOD.POLICY_AUTO);
      expect(payload.isAuthoritative).toBe(false);
    });

    test('null fallbackMethod and null row → policy_auto', () => {
      const payload = buildCompatibilityPayload(null, null);
      expect(payload.method).toBe(LEGACY_METHOD.POLICY_AUTO);
    });
  });

  // ── constants ─────────────────────────────────────────────────────────────

  describe('LEGACY_METHOD constants', () => {
    test('expected keys present', () => {
      expect(LEGACY_METHOD.EXACT_MATCH).toBe('exact_match');
      expect(LEGACY_METHOD.LEARNED_PATTERN).toBe('learned_pattern');
      expect(LEGACY_METHOD.POLICY_AUTO).toBe('policy_auto');
      expect(LEGACY_METHOD.MANUAL).toBe('manual_classification');
    });

    test('is frozen (immutable)', () => {
      expect(Object.isFrozen(LEGACY_METHOD)).toBe(true);
    });
  });

  describe('METHOD_LABELS', () => {
    test('covers all LEGACY_METHOD keys', () => {
      for (const [, value] of Object.entries(LEGACY_METHOD)) {
        expect(METHOD_LABELS[value]).toBeTruthy();
      }
    });
  });
});
