/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ClassificationEvidenceKeyBuilder.
 */

import { classificationEvidenceKeyBuilder, ClassificationEvidenceKeyBuilder } from '../../services/classificationEvidenceKeyBuilder.mjs';

describe('ClassificationEvidenceKeyBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new ClassificationEvidenceKeyBuilder();
  });

  describe('buildKey', () => {
    test('returns lowercase scope:value key', () => {
      expect(builder.buildKey('studio', 'A24')).toBe('studio:a24');
    });

    test('lowercases scope as well', () => {
      expect(builder.buildKey('Studio', 'A24')).toBe('studio:a24');
    });

    test('returns null when scope is missing', () => {
      expect(builder.buildKey('', 'A24')).toBeNull();
      expect(builder.buildKey(null, 'A24')).toBeNull();
      expect(builder.buildKey(undefined, 'A24')).toBeNull();
    });

    test('returns null when value is empty string', () => {
      expect(builder.buildKey('studio', '')).toBeNull();
    });

    test('returns null when value is null', () => {
      expect(builder.buildKey('studio', null)).toBeNull();
    });

    test('returns null when value is undefined', () => {
      expect(builder.buildKey('studio', undefined)).toBeNull();
    });

    test('coerces numeric value to string', () => {
      expect(builder.buildKey('certification', 18)).toBe('certification:18');
    });
  });

  describe('buildSingleGenreKey', () => {
    test('returns genre:lowercase key', () => {
      expect(builder.buildSingleGenreKey('Documentary')).toBe('genre:documentary');
    });

    test('lowercases already-lowercase input', () => {
      expect(builder.buildSingleGenreKey('documentary')).toBe('genre:documentary');
    });

    test('returns null for empty string', () => {
      expect(builder.buildSingleGenreKey('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(builder.buildSingleGenreKey(null)).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(builder.buildSingleGenreKey(undefined)).toBeNull();
    });
  });

  describe('buildGenreKey', () => {
    test('single-element array produces a plain genre key', () => {
      expect(builder.buildGenreKey(['Documentary'])).toBe('genre:documentary');
    });

    test('multi-element array sorts values and joins with |', () => {
      expect(builder.buildGenreKey(['Nature', 'Documentary'])).toBe('genre:documentary|nature');
    });

    test('already-sorted array is stable', () => {
      expect(builder.buildGenreKey(['documentary', 'nature'])).toBe('genre:documentary|nature');
    });

    test('returns null for empty array', () => {
      expect(builder.buildGenreKey([])).toBeNull();
    });

    test('returns null when argument is not an array', () => {
      expect(builder.buildGenreKey(null)).toBeNull();
      expect(builder.buildGenreKey(undefined)).toBeNull();
      expect(builder.buildGenreKey('Documentary')).toBeNull();
    });
  });

  describe('buildStudioKey', () => {
    test('returns studio:lowercase key', () => {
      expect(builder.buildStudioKey('A24')).toBe('studio:a24');
      expect(builder.buildStudioKey('Warner Bros.')).toBe('studio:warner bros.');
    });

    test('returns null for missing value', () => {
      expect(builder.buildStudioKey(null)).toBeNull();
    });
  });

  describe('buildFranchiseKey', () => {
    test('returns franchise:lowercase key', () => {
      expect(builder.buildFranchiseKey('MCU')).toBe('franchise:mcu');
    });

    test('returns null for missing value', () => {
      expect(builder.buildFranchiseKey('')).toBeNull();
    });
  });

  describe('buildCertificationKey', () => {
    test('returns certification:lowercase key', () => {
      expect(builder.buildCertificationKey('R')).toBe('certification:r');
      expect(builder.buildCertificationKey('PG-13')).toBe('certification:pg-13');
    });

    test('returns null for missing value', () => {
      expect(builder.buildCertificationKey(null)).toBeNull();
    });
  });

  describe('buildForScope', () => {
    test('delegates genre to buildSingleGenreKey', () => {
      expect(builder.buildForScope('genre', 'Documentary')).toBe('genre:documentary');
    });

    test('delegates studio to buildStudioKey', () => {
      expect(builder.buildForScope('studio', 'A24')).toBe('studio:a24');
    });

    test('delegates franchise to buildFranchiseKey', () => {
      expect(builder.buildForScope('franchise', 'MCU')).toBe('franchise:mcu');
    });

    test('delegates certification to buildCertificationKey', () => {
      expect(builder.buildForScope('certification', 'R')).toBe('certification:r');
    });

    test('falls back to buildKey for unknown scope', () => {
      expect(builder.buildForScope('network', 'HBO')).toBe('network:hbo');
    });

    test('scope comparison is case-insensitive', () => {
      expect(builder.buildForScope('Genre', 'Action')).toBe('genre:action');
      expect(builder.buildForScope('STUDIO', 'Pixar')).toBe('studio:pixar');
    });

    test('returns null when value is missing', () => {
      expect(builder.buildForScope('studio', null)).toBeNull();
    });
  });

  describe('module exports', () => {
    test('singleton export produces same keys as instantiated class', () => {
      expect(classificationEvidenceKeyBuilder.buildStudioKey('A24')).toBe(builder.buildStudioKey('A24'));
      expect(classificationEvidenceKeyBuilder.buildGenreKey(['Action', 'Thriller'])).toBe(
        builder.buildGenreKey(['Action', 'Thriller'])
      );
    });
  });
});
