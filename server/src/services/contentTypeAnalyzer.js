/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('contentTypeAnalyzer');

class ContentTypeAnalyzer {
  constructor() {
    // Detection patterns with keywords and confidence weights
    this.patterns = {
      standup: {
        keywords: [
          'stand-up comedy', 'comedy special', 'standup', 'live comedy',
          'recorded live at', 'comedy tour', 'one man show'
        ],
        requiredGenres: ['Documentary', 'Comedy'],
        confidence: 85,
        suggestedLabels: ['standup', 'comedy']
      },
      concert: {
        keywords: [
          'concert', 'live performance', 'tour', 'concert film',
          'music festival', 'live at', 'in concert', 'world tour'
        ],
        requiredGenres: ['Documentary', 'Music'],
        confidence: 85,
        suggestedLabels: ['concert', 'music']
      },
      adultAnimation: {
        keywords: [
          'adult animation', 'adult cartoon', 'animated sitcom',
          'mature animation', 'parody', 'satire'
        ],
        requiredGenres: ['Animation'],
        ratingCheck: ['TV-MA', 'R', 'NC-17'],
        excludeRatings: ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'],
        confidence: 80,
        suggestedLabels: ['adult_animation', 'animation']
      },
      realityTV: {
        keywords: [
          'reality', 'competition', 'contestants', 'elimination',
          'vote', 'judges', 'audition', 'compete'
        ],
        requiredGenres: ['Documentary', 'Reality'],
        confidence: 80,
        suggestedLabels: ['reality', 'reality_competition']
      },
      anime: {
        keywords: [
          'anime', 'manga', 'based on manga', 'shounen', 'shoujo',
          'seinen', 'isekai', 'mecha', 'japanese animation'
        ],
        languageCheck: ['ja'],
        confidence: 90,
        suggestedLabels: ['anime', 'animation']
      },
      kdrama: {
        keywords: [
          'korean drama', 'k-drama', 'kdrama', 'korean series'
        ],
        languageCheck: ['ko'],
        confidence: 90,
        suggestedLabels: ['kdrama', 'korean']
      },
      holiday: {
        keywords: [
          'christmas', 'holiday', 'santa claus', 'xmas', 'festive',
          'christmas special', 'holiday special'
        ],
        confidence: 75,
        suggestedLabels: ['holiday']
      },
      halloween: {
        keywords: [
          'halloween', 'trick or treat', 'haunted house', 'spooky',
          'halloween special'
        ],
        confidence: 75,
        suggestedLabels: ['halloween']
      }
    };
  }

  /**
   * Analyze metadata to detect content type
   * @param {object} metadata - Media metadata from TMDB
   * @param {number} classificationId - Classification ID for logging
   * @returns {Promise<object>} Analysis result
   */
  async analyze(metadata, classificationId = null) {
    try {
      const settings = await this.getSettings();
      
      if (!settings.enabled) {
        return { analyzed: false, reason: 'Content analysis disabled' };
      }

      const detections = [];
      const overview = (metadata.overview || '').toLowerCase();
      const title = (metadata.title || '').toLowerCase();
      const genres = (metadata.genres || []).map(g => g.toLowerCase());
      const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
      const certification = (metadata.certification || '').toUpperCase();
      const originalLanguage = metadata.original_language || '';

      // Check each pattern
      for (const [type, pattern] of Object.entries(this.patterns)) {
        const detection = this.checkPattern(
          type,
          pattern,
          { overview, title, genres, keywords, certification, originalLanguage }
        );

        if (detection.detected && detection.confidence >= settings.minConfidence) {
          detections.push(detection);
        }
      }

      // Sort by confidence and get the best match
      detections.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = detections[0] || null;

      // Log analysis
      if (classificationId && bestMatch) {
        await this.logAnalysis(classificationId, metadata.tmdb_id, bestMatch, metadata.genres);
      }

      return {
        analyzed: true,
        detections,
        bestMatch,
        overridesGenre: bestMatch ? this.shouldOverrideGenre(bestMatch, metadata) : false
      };
    } catch (error) {
      logger.error('Content analysis error', { error: error.message });
      return { analyzed: false, error: error.message };
    }
  }

  /**
   * Check if metadata matches a pattern
   * @param {string} type - Content type
   * @param {object} pattern - Pattern definition
   * @param {object} data - Metadata to check
   * @returns {object} Detection result
   */
  checkPattern(type, pattern, data) {
    let confidence = 0;
    const reasoning = [];
    let detected = false;

    // Check for excluded ratings (e.g., don't detect family-friendly content as adult)
    if (pattern.excludeRatings && pattern.excludeRatings.includes(data.certification)) {
      return {
        type,
        detected: false,
        confidence: 0,
        reasoning: [`Excluded due to rating: ${data.certification}`],
        suggestedLabels: pattern.suggestedLabels
      };
    }

    // Check required genres - must match ALL if specified
    if (pattern.requiredGenres) {
      const genreMatches = pattern.requiredGenres.filter(genre => 
        data.genres.includes(genre.toLowerCase())
      );
      
      if (genreMatches.length === pattern.requiredGenres.length) {
        confidence += 30;
        reasoning.push(`Matched required genres: ${genreMatches.join(', ')}`);
      } else {
        // Required genres not fully matched - return no detection
        return {
          type,
          detected: false,
          confidence: 0,
          reasoning: [`Required genres not matched (need: ${pattern.requiredGenres.join(', ')}, have: ${data.genres.join(', ')})`],
          suggestedLabels: pattern.suggestedLabels
        };
      }
    }

    // Check keywords in overview and title
    const keywordMatches = pattern.keywords.filter(keyword => 
      data.overview.includes(keyword) || data.title.includes(keyword) || 
      data.keywords.includes(keyword)
    );

    if (keywordMatches.length > 0) {
      confidence += Math.min(keywordMatches.length * 15, 50);
      reasoning.push(`Matched keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
    }

    // Check rating
    if (pattern.ratingCheck && pattern.ratingCheck.includes(data.certification)) {
      confidence += 20;
      reasoning.push(`Matched rating: ${data.certification}`);
    }

    // Check language
    if (pattern.languageCheck && pattern.languageCheck.includes(data.originalLanguage)) {
      confidence += 50;
      reasoning.push(`Matched language: ${data.originalLanguage}`);
    }

    // Consider pattern's base confidence
    if (confidence > 0) {
      detected = true;
      // Use weighted average favoring accumulated evidence (70%) over base confidence (30%)
      confidence = Math.min((confidence * 0.7) + (pattern.confidence * 0.3), 100);
    }

    return {
      type,
      detected,
      confidence: Math.round(confidence),
      reasoning,
      suggestedLabels: pattern.suggestedLabels
    };
  }

  /**
   * Determine if detection should override TMDB genres
   * @param {object} detection - Detection result
   * @param {object} metadata - Original metadata
   * @returns {boolean} Should override
   */
  shouldOverrideGenre(detection, metadata) {
    // Override if confidence is high and it's a specific content type
    const overrideTypes = ['standup', 'concert', 'anime', 'kdrama'];
    return overrideTypes.includes(detection.type) && detection.confidence >= 80;
  }

  /**
   * Log content analysis to database
   * @param {number} classificationId - Classification ID
   * @param {number} tmdbId - TMDB ID
   * @param {object} detection - Detection result
   * @param {Array} originalGenres - Original genres from TMDB
   */
  async logAnalysis(classificationId, tmdbId, detection, originalGenres) {
    try {
      await db.query(
        `INSERT INTO content_analysis_log 
         (classification_id, tmdb_id, detected_type, confidence, reasoning, 
          suggested_labels, overrides_genre, original_genres)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          classificationId,
          tmdbId,
          detection.type,
          detection.confidence,
          detection.reasoning,
          detection.suggestedLabels,
          this.shouldOverrideGenre(detection, { genres: originalGenres }),
          originalGenres
        ]
      );
    } catch (error) {
      logger.error('Error logging content analysis', { error: error.message });
    }
  }

  /**
   * Get content analysis settings
   * @returns {Promise<object>} Settings
   */
  async getSettings() {
    try {
      const result = await db.query(
        `SELECT key, value FROM settings 
         WHERE key IN ('content_analysis_enabled', 'content_analysis_min_confidence')`
      );

      const settings = {
        enabled: true,
        minConfidence: 75
      };

      result.rows.forEach(row => {
        if (row.key === 'content_analysis_enabled') {
          settings.enabled = row.value === 'true';
        } else if (row.key === 'content_analysis_min_confidence') {
          settings.minConfidence = parseInt(row.value);
        }
      });

      return settings;
    } catch (error) {
      logger.error('Error getting settings', { error: error.message });
      return { enabled: true, minConfidence: 75 };
    }
  }
}

module.exports = new ContentTypeAnalyzer();
