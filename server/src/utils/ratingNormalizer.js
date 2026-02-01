/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const AGE_TO_MPAA_MAP = {
  // Age-based to MPAA Movie ratings
  '0': 'G',
  '6': 'G',
  '7': 'PG',
  '10': 'PG',
  '12': 'PG-13',
  '13': 'PG-13',
  '14': 'PG-13',
  '15': 'R',
  '16': 'R',
  '17': 'R',
  '18': 'NC-17',
  
  // UK ratings
  'U': 'G',
  'PG': 'PG',
  '12A': 'PG-13',
  '15': 'R',  // UK 15 rating (also covered by age-based '15' above)
  '18': 'NC-17',  // UK 18 rating (also covered by age-based '18' above)
  
  // Australia
  'G': 'G',
  'PG': 'PG',
  'M': 'PG-13',
  'MA15+': 'R',
  'R18+': 'NC-17',
  
  // Germany (FSK)
  'FSK 0': 'G',
  'FSK 6': 'G',
  'FSK 12': 'PG-13',
  'FSK 16': 'R',
  'FSK 18': 'NC-17',
};

const AGE_TO_TV_MAP = {
  '7': 'TV-Y7',
  '10': 'TV-PG',
  '12': 'TV-PG',
  '13': 'TV-14',
  '14': 'TV-14',
  '15': 'TV-14',
  '16': 'TV-MA',
  '17': 'TV-MA',
  '18': 'TV-MA',
};

const STANDARD_MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'Unrated'];
const STANDARD_TV_RATINGS = ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

// SQL fragment for checking if rating needs normalization
const NEEDS_NORMALIZATION_SQL = `(content_rating ~ '^[0-9]+$' 
             OR content_rating NOT IN ('G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR', 'Unrated'))`;

class RatingNormalizer {
  /**
   * Check if a rating is already a standard MPAA or TV rating
   * @param {string} rating - The rating to check
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {boolean} - True if rating is standard
   */
  isStandardRating(rating, mediaType = 'movie') {
    if (!rating) return false;
    const standards = mediaType === 'tv' ? STANDARD_TV_RATINGS : STANDARD_MOVIE_RATINGS;
    return standards.includes(rating);
  }

  /**
   * Normalize a rating to MPAA or TV standard
   * @param {string} rating - The rating to normalize
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {string} - Normalized rating or 'NR' if unknown
   */
  normalizeRating(rating, mediaType = 'movie') {
    if (!rating || rating === 'N/A') return 'NR';
    if (this.isStandardRating(rating, mediaType)) return rating;
    
    const map = mediaType === 'tv' ? AGE_TO_TV_MAP : AGE_TO_MPAA_MAP;
    return map[rating] || 'NR';
  }

  /**
   * Get the priority rating for an item using the priority system:
   * 1. OMDb rated field (most reliable)
   * 2. TMDB US certification
   * 3. Normalized age-based rating
   * 4. NR for unknowns
   * 
   * @param {Object} item - Media server item with metadata
   * @returns {string} - The priority rating
   */
  getPriorityRating(item) {
    // 1. OMDb (most reliable)
    if (item.metadata?.omdb?.data?.rated && item.metadata.omdb.data.rated !== 'N/A') {
      return item.metadata.omdb.data.rated;
    }
    
    // 2. TMDB US certification
    if (item.metadata?.tmdb?.certification) {
      return item.metadata.tmdb.certification;
    }
    
    // 3. Normalize Plex rating
    if (item.content_rating) {
      return this.normalizeRating(item.content_rating, item.media_type);
    }
    
    return 'NR';
  }
  /**
   * Get the SQL fragment for checking if a rating needs normalization
   * Used in database queries to find items needing processing
   * @returns {string} SQL WHERE condition
   */
  getNeedsNormalizationSQL() {
    return NEEDS_NORMALIZATION_SQL;
  }
}

module.exports = new RatingNormalizer();
