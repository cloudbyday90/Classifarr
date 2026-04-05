/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for backfill_classification_evidence transform functions.
 * Pure unit tests — no database connection required.
 */

const {
  transformExactMatchRow,
  transformGenrePatternRow,
  transformDiscoveredPatternRow
} = require('../../scripts/backfill_classification_evidence');

describe('backfill_classification_evidence', () => {

  // ── transformExactMatchRow ─────────────────────────────────────────────────

  describe('transformExactMatchRow', () => {
    test('maps learning_patterns exact_match to item_exact evidence DTO', () => {
      const row = {
        id: 1,
        tmdb_id: 550,
        media_type: 'movie',
        library_id: 7,
        pattern_type: 'exact_match',
        pattern_data: { title: 'Fight Club' },
        confidence: 100,
        usage_count: 3,
        success_rate: 100.0,
        metadata: null,
        created_by: 'admin'
      };

      const result = transformExactMatchRow(row);

      expect(result.scope).toBe('item_exact');
      expect(result.tmdb_id).toBe(550);
      expect(result.media_type).toBe('movie');
      expect(result.library_id).toBe(7);
      expect(result.provenance).toBe('human_confirmed');
      expect(result.status).toBe('active');
      expect(result.source_system).toBe('learning_patterns');
      expect(result.evidence_key).toBeNull();
      expect(result.confidence).toBe(100);
      expect(result.created_by).toBe('admin');
    });

    test('falls back to metadata when pattern_data is null', () => {
      const row = {
        tmdb_id: 551,
        media_type: 'movie',
        library_id: 8,
        pattern_data: null,
        metadata: { title: 'Se7en' },
        confidence: 100,
        usage_count: 0,
        success_rate: null,
        created_by: null
      };

      const result = transformExactMatchRow(row);

      expect(result.evidence_data).toEqual({ title: 'Se7en' });
    });

    test('defaults confidence to 100 when null', () => {
      const row = {
        tmdb_id: 552,
        media_type: 'movie',
        library_id: 9,
        pattern_data: null,
        metadata: null,
        confidence: null,
        usage_count: null,
        success_rate: null,
        created_by: null
      };

      const result = transformExactMatchRow(row);

      expect(result.confidence).toBe(100);
      expect(result.usage_count).toBe(0);
    });

    test('preserves null tmdb_id', () => {
      const row = {
        tmdb_id: null,
        media_type: 'movie',
        library_id: 7,
        pattern_data: {},
        confidence: 100,
        usage_count: 0,
        success_rate: null,
        created_by: null
      };

      const result = transformExactMatchRow(row);

      expect(result.tmdb_id).toBeNull();
    });
  });

  // ── transformGenrePatternRow ───────────────────────────────────────────────

  describe('transformGenrePatternRow', () => {
    test('maps learning_patterns genre_pattern to genre evidence DTO', () => {
      const row = {
        id: 5,
        tmdb_id: null,
        media_type: 'movie',
        library_id: 58,
        pattern_type: 'genre_pattern',
        pattern_data: { genre: 'documentary' },
        confidence: 85,
        usage_count: 3,
        success_rate: 100.0,
        created_by: 'system'
      };

      const result = transformGenrePatternRow(row);

      expect(result.scope).toBe('genre');
      expect(result.tmdb_id).toBeNull();
      expect(result.media_type).toBe('movie');
      expect(result.library_id).toBe(58);
      expect(result.evidence_key).toBe('genre:documentary');
      expect(result.provenance).toBe('policy_confirmed');
      expect(result.status).toBe('active');
      expect(result.source_system).toBe('learning_patterns');
      expect(result.confidence).toBe(85);
    });

    test('uses classificationEvidenceKeyBuilder — genre is lowercased via builder', () => {
      const row = {
        media_type: 'movie',
        library_id: 1,
        pattern_data: { genre: 'Documentary' },
        confidence: 90,
        usage_count: 5,
        success_rate: 100,
        created_by: null
      };

      const result = transformGenrePatternRow(row);

      // Key builder should lowercase
      expect(result.evidence_key).toBe('genre:documentary');
    });

    test('sets evidence_key to null when genre is missing from pattern_data', () => {
      const row = {
        media_type: 'movie',
        library_id: 2,
        pattern_data: {},
        confidence: 80,
        usage_count: 1,
        success_rate: 100,
        created_by: null
      };

      const result = transformGenrePatternRow(row);

      expect(result.evidence_key).toBeNull();
    });

    test('sets evidence_key to null when pattern_data is null', () => {
      const row = {
        media_type: 'movie',
        library_id: 2,
        pattern_data: null,
        confidence: 80,
        usage_count: 1,
        success_rate: null,
        created_by: null
      };

      const result = transformGenrePatternRow(row);

      expect(result.evidence_key).toBeNull();
      expect(result.evidence_data).toEqual({});
    });
  });

  // ── transformDiscoveredPatternRow ──────────────────────────────────────────

  describe('transformDiscoveredPatternRow', () => {
    test('maps discovered_patterns studio row to studio evidence DTO', () => {
      const row = {
        id: 10,
        pattern_type: 'studio',
        pattern_value: 'A24',
        library_id: 12,
        confidence: 72,
        sample_size: 14,
        support_count: 14,
        status: 'discovered',
        auto_approved: false,
        approved_by: null
      };

      const result = transformDiscoveredPatternRow(row);

      expect(result.scope).toBe('studio');
      expect(result.evidence_key).toBe('studio:a24');
      expect(result.provenance).toBe('mined');
      expect(result.status).toBe('candidate');
      expect(result.source_system).toBe('discovered_patterns');
      expect(result.tmdb_id).toBeNull();
      expect(result.media_type).toBeNull();
      expect(result.library_id).toBe(12);
    });

    test('maps approved discovered pattern to status=active', () => {
      const row = {
        pattern_type: 'franchise',
        pattern_value: 'MCU',
        library_id: 5,
        confidence: 88,
        sample_size: 30,
        support_count: 28,
        status: 'approved',
        auto_approved: false,
        approved_by: 'admin'
      };

      const result = transformDiscoveredPatternRow(row);

      expect(result.status).toBe('active');
      expect(result.created_by).toBe('admin');
    });

    test('maps auto_approved discovered pattern to status=active', () => {
      const row = {
        pattern_type: 'certification',
        pattern_value: 'R',
        library_id: 3,
        confidence: 80,
        sample_size: 20,
        support_count: 18,
        status: 'discovered',
        auto_approved: true,
        approved_by: null
      };

      const result = transformDiscoveredPatternRow(row);

      expect(result.status).toBe('active');
      expect(result.evidence_key).toBe('certification:r');
    });

    test('uses classificationEvidenceKeyBuilder for all scope types', () => {
      const cases = [
        { pattern_type: 'genre', pattern_value: 'Documentary', expected: 'genre:documentary' },
        { pattern_type: 'studio', pattern_value: 'A24', expected: 'studio:a24' },
        { pattern_type: 'franchise', pattern_value: 'MCU', expected: 'franchise:mcu' },
        { pattern_type: 'certification', pattern_value: 'PG-13', expected: 'certification:pg-13' }
      ];

      for (const { pattern_type, pattern_value, expected } of cases) {
        const row = {
          pattern_type,
          pattern_value,
          library_id: 1,
          confidence: 70,
          sample_size: 10,
          support_count: 9,
          status: 'discovered',
          auto_approved: false,
          approved_by: null
        };
        const result = transformDiscoveredPatternRow(row);
        expect(result.evidence_key).toBe(expected);
      }
    });

    test('stores evidence_data with original pattern metadata', () => {
      const row = {
        pattern_type: 'studio',
        pattern_value: 'A24',
        library_id: 7,
        confidence: 75,
        sample_size: 15,
        support_count: 13,
        status: 'discovered',
        auto_approved: false,
        approved_by: null
      };

      const result = transformDiscoveredPatternRow(row);

      expect(result.evidence_data).toMatchObject({
        patternType: 'studio',
        patternValue: 'A24',
        sampleSize: 15,
        supportCount: 13,
        autoApproved: false
      });
    });

    test('sets evidence_key to null when pattern_value is missing', () => {
      const row = {
        pattern_type: 'studio',
        pattern_value: null,
        library_id: 1,
        confidence: 70,
        sample_size: 5,
        support_count: 5,
        status: 'discovered',
        auto_approved: false,
        approved_by: null
      };

      const result = transformDiscoveredPatternRow(row);

      expect(result.evidence_key).toBeNull();
    });
  });
});
