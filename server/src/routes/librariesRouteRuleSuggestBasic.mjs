/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerBasicSuggestRoute(router, { db, normalizeMetadataListLower }) {
  router.get('/:id/rules/suggest', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const analysis = await db.query(
        `
      SELECT 
        array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
        array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
        array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages,
        COUNT(*) as total_items
      FROM media_server_items msi
        LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
      WHERE msi.library_id = $1
    `,
        [id]
      );

      const existingRulesResult = await db.query('SELECT rule_type, value FROM library_rules WHERE library_id = $1', [id]);
      const existingRules = existingRulesResult.rows;

      const data = analysis.rows[0];
      const suggestions = [];

      const ruleExists = (type, val) => {
        return existingRules.some((r) => r.rule_type === type && (r.value === val || r.value.includes(val)));
      };

      if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
        const val = data.ratings.join(',');
        if (!ruleExists('rating', val)) {
          suggestions.push({
            rule_type: 'rating',
            operator: 'includes',
            value: val,
            description: `Only ratings: ${data.ratings.join(', ')}`,
            is_exception: false,
          });
        }
      }

      if (data.genres && data.genres.length > 0) {
        const topGenres = data.genres.slice(0, 5);
        const val = topGenres.join(',');
        if (!ruleExists('genre', val)) {
          suggestions.push({
            rule_type: 'genre',
            operator: 'includes',
            value: val,
            description: `Common genres: ${topGenres.join(', ')}`,
            is_exception: false,
          });
        }
      }

      if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
        const val = data.languages[0];
        if (!ruleExists('language', val)) {
          suggestions.push({
            rule_type: 'language',
            operator: 'equals',
            value: val,
            description: `Only ${val} content${val === 'ja' ? ' (Anime)' : ''}`,
            is_exception: false,
          });
        }
      }

      const keywordAnalysis = await db.query(
        `
      SELECT 
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%christmas%' OR LOWER(title) LIKE '%xmas%') as christmas_count,
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%holiday%') as holiday_count,
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%hallmark%' OR LOWER(msi.studio) LIKE '%hallmark%') as hallmark_count,
        COUNT(*) as total
      FROM media_server_items msi
      WHERE msi.library_id = $1
    `,
        [id]
      );

      const kw = keywordAnalysis.rows[0];
      const total = parseInt(kw.total) || 1;
      const christmasRatio = parseInt(kw.christmas_count) / total;
      const holidayRatio = parseInt(kw.holiday_count) / total;
      const hallmarkRatio = parseInt(kw.hallmark_count) / total;

      if (christmasRatio >= 0.3) {
        const val = 'christmas,xmas,holiday,santa,snowman,elf';
        if (!ruleExists('keyword', val)) {
          suggestions.push({
            rule_type: 'keyword',
            operator: 'contains',
            value: val,
            description: `Christmas/Holiday content (${Math.round(christmasRatio * 100)}% match)`,
            is_exception: false,
          });
        }
      } else if (holidayRatio >= 0.3) {
        const val = 'holiday,christmas,seasonal';
        if (!ruleExists('keyword', val)) {
          suggestions.push({
            rule_type: 'keyword',
            operator: 'contains',
            value: val,
            description: `Holiday content (${Math.round(holidayRatio * 100)}% match)`,
            is_exception: false,
          });
        }
      }

      if (hallmarkRatio >= 0.3) {
        const val = 'hallmark';
        if (!ruleExists('keyword', val)) {
          suggestions.push({
            rule_type: 'keyword',
            operator: 'contains',
            value: val,
            description: `Hallmark productions (${Math.round(hallmarkRatio * 100)}% match)`,
            is_exception: false,
          });
        }
      }

      const libraryResult = await db.query('SELECT name FROM libraries WHERE id = $1', [id]);
      const libraryName = libraryResult.rows[0]?.name?.toLowerCase() || '';

      const normalizedGenres = normalizeMetadataListLower(data.genres);
      const hasAnimeGenre =
        normalizedGenres.includes('animation') ||
        normalizedGenres.includes('anime') ||
        normalizedGenres.some((g) => g.includes('anime'));

      const isJapanese = data.languages && data.languages.includes('ja');
      const libraryIsAnime = libraryName.includes('anime');

      if ((hasAnimeGenre && isJapanese) || (hasAnimeGenre && libraryIsAnime)) {
        if (!ruleExists('language', 'ja')) {
          suggestions.push({
            rule_type: 'language',
            operator: 'equals',
            value: 'ja',
            description: 'Japanese Anime content',
            is_exception: false,
          });
        }

        const animeVal = 'Animation,Anime';
        if (
          !ruleExists('genre', animeVal) &&
          !suggestions.find((s) => s.rule_type === 'genre' && s.value.includes('Animation'))
        ) {
          suggestions.push({
            rule_type: 'genre',
            operator: 'includes',
            value: animeVal,
            description: 'Anime/Animation content',
            is_exception: false,
          });
        }
      }

      res.json({
        totalItems: parseInt(data.total_items) || 0,
        suggestions,
      });
  }));
}
