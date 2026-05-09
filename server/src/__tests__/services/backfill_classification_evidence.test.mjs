/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for the Phase 2 backfill_classification_evidence.js transform functions.
 * These tests cover the pure-function logic only — no database access required.
 */

import {
  transformDiscoveredPatternRow,
  transformLearningPatternRow,
} from '../../services/classificationEvidenceBackfillCliService.mjs';
import { ClassificationEvidenceKeyBuilder } from '../../services/classificationEvidenceKeyBuilder.mjs';

const keyBuilder = new ClassificationEvidenceKeyBuilder();

describe('transformLearningPatternRow', () => {
  describe('exact_match rows', () => {
    test('maps to item_exact scope with human_confirmed provenance', () => {
      const row = {
        id: 1,
        tmdb_id: 550,
        media_type: 'movie',
        library_id: 10,
        pattern_type: 'exact_match',
        pattern_data: { title: 'Fight Club' },
        metadata: null,
        confidence: null,
        usage_count: 2,
        success_rate: 100,
        created_by: 'user_fix'
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.scope).toBe('item_exact');
      expect(result.provenance).toBe('human_confirmed');
      expect(result.confidence).toBe(100);
      expect(result.status).toBe('active');
      expect(result.tmdb_id).toBe(550);
      expect(result.library_id).toBe(10);
      expect(result.media_type).toBe('movie');
      expect(result.evidence_key).toBeNull();
      expect(result.source_system).toBe('learning_patterns');
    });

    test('uses metadata fallback when pattern_data is null', () => {
      const row = {
        id: 2,
        tmdb_id: 680,
        media_type: 'movie',
        library_id: 5,
        pattern_type: 'exact_match',
        pattern_data: null,
        metadata: { foo: 'bar' },
        confidence: null,
        usage_count: 0,
        success_rate: null,
        created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.evidence_data).toEqual({ foo: 'bar' });
    });

    test('falls back created_by to backfill scope when null', () => {
      const row = {
        id: 3, tmdb_id: 1, media_type: 'movie', library_id: 1,
        pattern_type: 'exact_match', pattern_data: null, metadata: null,
        confidence: null, usage_count: 0, success_rate: null, created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.created_by).toBe('backfill_classification_evidence');
    });
  });

  describe('genre_pattern rows', () => {
    test('maps to genre scope with policy_confirmed provenance', () => {
      const row = {
        id: 10,
        tmdb_id: null,
        media_type: 'movie',
        library_id: 8,
        pattern_type: 'genre_pattern',
        pattern_data: { genre: 'documentary' },
        metadata: null,
        confidence: 85,
        usage_count: 3,
        success_rate: 100,
        created_by: 'system'
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.scope).toBe('genre');
      expect(result.provenance).toBe('policy_confirmed');
      expect(result.evidence_key).toBe('genre:documentary');
      expect(result.status).toBe('active');
      expect(result.confidence).toBe(85);
      expect(result.tmdb_id).toBeNull();
      expect(result.source_system).toBe('learning_patterns');
    });

    test('normalizes genre to lowercase key', () => {
      const row = {
        id: 11, tmdb_id: null, media_type: 'movie', library_id: 8,
        pattern_type: 'genre_pattern',
        pattern_data: { genre: 'Documentary' },
        metadata: null, confidence: 80, usage_count: 1, success_rate: 100, created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.evidence_key).toBe('genre:documentary');
    });

    test('returns null when pattern_data has no genre', () => {
      const row = {
        id: 12, tmdb_id: null, media_type: 'movie', library_id: 8,
        pattern_type: 'genre_pattern',
        pattern_data: {},
        metadata: null, confidence: 80, usage_count: 1, success_rate: 100, created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result).toBeNull();
    });

    test('returns null when pattern_data is null', () => {
      const row = {
        id: 13, tmdb_id: null, media_type: 'movie', library_id: 8,
        pattern_type: 'genre_pattern',
        pattern_data: null,
        metadata: null, confidence: 80, usage_count: 1, success_rate: 100, created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result).toBeNull();
    });

    test('defaults confidence to 85 when null', () => {
      const row = {
        id: 14, tmdb_id: null, media_type: 'tv', library_id: 3,
        pattern_type: 'genre_pattern',
        pattern_data: { genre: 'drama' },
        metadata: null, confidence: null, usage_count: 0, success_rate: null, created_by: null
      };
      const result = transformLearningPatternRow(row, keyBuilder);
      expect(result.confidence).toBe(85);
    });
  });

  describe('unknown pattern_type rows', () => {
    test('returns null for unrecognized pattern_type', () => {
      const row = {
        id: 99, tmdb_id: null, media_type: 'movie', library_id: 1,
        pattern_type: 'custom_pattern',
        pattern_data: {}, metadata: null, confidence: 50, usage_count: 0,
        success_rate: null, created_by: null
      };
      expect(transformLearningPatternRow(row, keyBuilder)).toBeNull();
    });
  });
});

describe('transformDiscoveredPatternRow', () => {
  describe('valid scopes', () => {
    test('maps studio pattern to studio scope with mined provenance', () => {
      const row = {
        id: 100,
        pattern_type: 'studio',
        pattern_value: 'A24',
        library_id: 5,
        confidence: 72,
        sample_size: 10,
        support_count: 8,
        status: 'discovered',
        auto_approved: false
      };
      const result = transformDiscoveredPatternRow(row, keyBuilder);
      expect(result.scope).toBe('studio');
      expect(result.provenance).toBe('mined');
      expect(result.evidence_key).toBe('studio:a24');
      expect(result.status).toBe('candidate');
      expect(result.source_system).toBe('discovered_patterns');
    });

    test('maps approved pattern to active status', () => {
      const row = {
        id: 101, pattern_type: 'franchise', pattern_value: 'mcu', library_id: 3,
        confidence: 90, sample_size: 20, support_count: 18,
        status: 'approved', auto_approved: false
      };
      const result = transformDiscoveredPatternRow(row, keyBuilder);
      expect(result.status).toBe('active');
    });

    test('maps auto_approved pattern to active status', () => {
      const row = {
        id: 102, pattern_type: 'genre', pattern_value: 'Action', library_id: 2,
        confidence: 80, sample_size: 15, support_count: 12,
        status: 'discovered', auto_approved: true
      };
      const result = transformDiscoveredPatternRow(row, keyBuilder);
      expect(result.status).toBe('active');
      expect(result.evidence_key).toBe('genre:action');
    });

    test('maps certification pattern correctly', () => {
      const row = {
        id: 103, pattern_type: 'certification', pattern_value: 'R', library_id: 7,
        confidence: 65, sample_size: 5, support_count: 4,
        status: 'candidate', auto_approved: false
      };
      const result = transformDiscoveredPatternRow(row, keyBuilder);
      expect(result.evidence_key).toBe('certification:r');
    });
  });
});
