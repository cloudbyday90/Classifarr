/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as dbModule from '../config/database.mjs';
import { classificationEvidenceKeyBuilder } from './classificationEvidenceKeyBuilder.mjs';
import { normalizeMetadataList as _normalizeMetadataList, normalizeMetadataListLower as _normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { resolveExecutor } from '../utils/dbUtils.mjs';

export class LearningPatternEvidenceAdapter {
  constructor(deps = {}) {
    this.db = deps.db || dbModule;
    this.evidenceKeyBuilder = deps.evidenceKeyBuilder || classificationEvidenceKeyBuilder;
    this.normalizeMetadataList = deps.normalizeMetadataList || _normalizeMetadataList;
    this.normalizeMetadataListLower = deps.normalizeMetadataListLower || _normalizeMetadataListLower;
  }

  async findExactMatch({ tmdbId, mediaType = null }) {
    if (!tmdbId) return null;

    const params = [tmdbId];
    let where = `tmdb_id = $1 AND pattern_type = 'exact_match'`;

    if (mediaType) {
      params.push(mediaType);
      where += ` AND media_type = $2`;
    }

    const result = await this.db.query(
      `SELECT library_id, confidence, pattern_type, media_type, updated_at
       FROM learning_patterns
       WHERE ${where}
       ORDER BY updated_at DESC LIMIT 1`,
      params
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      matched: true,
      scope: 'item_exact',
      libraryId: row.library_id,
      confidence: row.confidence ?? 100,
      provenance: 'human_confirmed',
      source: 'learning_patterns',
      legacyPatternType: row.pattern_type,
      mediaType: row.media_type || mediaType || null,
      updatedAt: row.updated_at || null
    };
  }

  async collectRelatedEvidence({ metadata, candidateLibraryIds = null }) {
    const genres = this.normalizeMetadataListLower(metadata?.genres);
    if (genres.length === 0) return [];

    const mediaType = metadata?.media_type || metadata?.mediaType || null;
    const params = [genres, mediaType];
    let candidateFilter = '';

    if (Array.isArray(candidateLibraryIds) && candidateLibraryIds.length > 0) {
      params.push(candidateLibraryIds);
      candidateFilter = 'AND library_id = ANY($3::int[])';
    }

    const result = await this.db.query(
      `SELECT library_id, confidence, usage_count, success_rate, pattern_data, media_type
       FROM learning_patterns
       WHERE pattern_type = 'genre_pattern'
         AND success_rate >= 70
         AND ($1::text[] IS NULL OR (pattern_data->>'genre') = ANY($1::text[]))
         AND ($2::text IS NULL OR media_type = $2)
         ${candidateFilter}
       ORDER BY usage_count DESC, confidence DESC`,
      params
    );

    return result.rows.map((row) => ({
      scope: 'genre',
      libraryId: row.library_id,
      confidence: row.confidence ?? 0,
      usageCount: row.usage_count ?? 0,
      successRate: row.success_rate ?? null,
      evidenceKey: row.pattern_data?.genre ? this.evidenceKeyBuilder.buildSingleGenreKey(row.pattern_data.genre) : null,
      evidenceData: row.pattern_data || {},
      provenance: 'policy_confirmed',
      source: 'learning_patterns',
      status: 'active',
      mediaType: row.media_type || mediaType || null
    }));
  }

  async purgeEvidence({ tmdbId, mediaType = null, scopes = [], client = null }) {
    if (!tmdbId) {
      return { deleted: 0, deletedByScope: {} };
    }

    const executor = resolveExecutor(client, this.db);
    const scopeSet = new Set(Array.isArray(scopes) && scopes.length > 0 ? scopes : ['item_exact']);
    const deletedByScope = {};
    let deleted = 0;

    if (scopeSet.has('item_exact')) {
      const result = await executor.query(
        `DELETE FROM learning_patterns
         WHERE pattern_type = 'exact_match'
           AND tmdb_id = $1
           AND ($2::text IS NULL OR media_type = $2)`,
        [tmdbId, mediaType]
      );
      deletedByScope.item_exact = result.rowCount || 0;
      deleted += deletedByScope.item_exact;
    }

    return { deleted, deletedByScope };
  }

  async listAll({ client = null } = {}) {
    const executor = resolveExecutor(client, this.db);
    const result = await executor.query('SELECT * FROM learning_patterns ORDER BY id');
    return result.rows;
  }

  async purgeAll({ client = null } = {}) {
    const executor = resolveExecutor(client, this.db);
    const result = await executor.query('DELETE FROM learning_patterns RETURNING id');
    return {
      deleted: result.rowCount || 0,
      rows: result.rows || []
    };
  }

  async rememberExactMatch({
    tmdbId,
    mediaType,
    libraryId,
    payload = null,
    createdBy = null,
    client = null,
    payloadColumn = 'metadata',
    conflictMode = 'do_nothing'
  }) {
    if (!tmdbId || !libraryId) return null;

    const executor = resolveExecutor(client, this.db);
    const normalizedMediaType = mediaType || 'unknown';
    const normalizedPayload = payload && typeof payload === 'object' ? JSON.stringify(payload) : payload;

    if (payloadColumn === 'pattern_data') {
      if (conflictMode === 'update_payload') {
        const result = await executor.query(
          `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tmdb_id, media_type, pattern_type) 
           DO UPDATE SET library_id = $3, confidence = $6, updated_at = NOW()
           RETURNING *`,
          [tmdbId, normalizedMediaType, libraryId, 'exact_match', normalizedPayload, 100.0]
        );
        return result.rows[0] || null;
      }

      const result = await executor.query(
        `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [tmdbId, normalizedMediaType, libraryId, 'exact_match', normalizedPayload, 100.0]
      );
      return result.rows[0] || null;
    }

    const result = await executor.query(
      `INSERT INTO learning_patterns 
       (tmdb_id, media_type, library_id, pattern_type, confidence, metadata, created_by)
       VALUES ($1, $2, $3, 'exact_match', 100, $4, $5)
       ON CONFLICT (tmdb_id, media_type, pattern_type) 
       DO UPDATE SET library_id = $3, confidence = 100, metadata = $4, created_by = $5, updated_at = NOW()
       RETURNING *`,
      [tmdbId, normalizedMediaType, libraryId, normalizedPayload, createdBy]
    );
    return result.rows[0] || null;
  }

  async reinforceGenrePatterns({
    mediaType,
    libraryId,
    genres,
    createdBy,
    client = null
  }) {
    const executor = resolveExecutor(client, this.db);
    const normalizedGenres = this.normalizeMetadataList(genres);
    const touched = [];

    for (const genre of normalizedGenres) {
      const genreLower = String(genre).toLowerCase();
      await executor.query(
        'SELECT pg_advisory_xact_lock(hashtext($1::text), $2)',
        [`genre_pattern:${mediaType}:${genreLower}`, libraryId]
      );
      const updateResult = await executor.query(
        `UPDATE learning_patterns
            SET usage_count = learning_patterns.usage_count + 1,
                confidence = LEAST(learning_patterns.confidence + 2, 95),
                updated_at = NOW()
          WHERE pattern_type = 'genre_pattern'
            AND media_type = $1
            AND library_id = $2
            AND pattern_data->>'genre' = $3::text
          RETURNING id`,
        [mediaType, libraryId, genreLower]
      );

      if ((updateResult.rowCount || 0) === 0) {
        await executor.query(
          `INSERT INTO learning_patterns
             (tmdb_id, media_type, library_id, pattern_type, pattern_data,
              confidence, usage_count, success_rate, created_by)
           VALUES (NULL, $1, $2, 'genre_pattern',
                   jsonb_build_object('genre', $3::text),
                   85, 1, 100.00, $4)`,
          [mediaType, libraryId, genreLower, createdBy]
        );
      }

      touched.push(genreLower);
    }

    return touched;
  }

  async restoreLegacyPattern({ pattern, libraryId, client = null }) {
    if (!pattern || !libraryId) return null;

    const executor = resolveExecutor(client, this.db);
    const mediaType = pattern.media_type || 'unknown';
    const patternType = pattern.pattern_type || 'exact_match';
    const patternData = pattern.pattern_data ?? null;
    const confidence = pattern.confidence ?? 100;
    const usageCount = pattern.usage_count ?? 0;
    const successRate = pattern.success_rate ?? 100.0;
    const metadata = pattern.metadata ?? null;
    const createdBy = pattern.created_by ?? null;
    const createdAt = pattern.created_at ?? null;
    const updatedAt = pattern.updated_at ?? null;

    const result = await executor.query(
      `INSERT INTO learning_patterns
       (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence, usage_count, success_rate, metadata, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, NOW()), COALESCE($12, NOW()))
       ON CONFLICT (tmdb_id, media_type, pattern_type) DO UPDATE SET
         library_id = EXCLUDED.library_id,
         pattern_data = EXCLUDED.pattern_data,
         confidence = EXCLUDED.confidence,
         usage_count = EXCLUDED.usage_count,
         success_rate = EXCLUDED.success_rate,
         metadata = EXCLUDED.metadata,
         created_by = EXCLUDED.created_by,
         updated_at = NOW()
       RETURNING *`,
      [
        pattern.tmdb_id,
        mediaType,
        libraryId,
        patternType,
        patternData,
        confidence,
        usageCount,
        successRate,
        metadata,
        createdBy,
        createdAt,
        updatedAt,
      ]
    );

    return result.rows[0] || null;
  }
}

export const learningPatternEvidenceAdapter = new LearningPatternEvidenceAdapter();
