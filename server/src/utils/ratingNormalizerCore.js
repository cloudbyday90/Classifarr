/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Rating normalization helper utilities.
 */

const AGE_TO_MPAA_MAP = {
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
  U: 'G',
  PG: 'PG',
  '12A': 'PG-13',
  M: 'PG-13',
  'MA15+': 'R',
  'R18+': 'NC-17',
  G: 'G',
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
const STANDARD_TV_RATINGS = ['TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

const NEEDS_NORMALIZATION_SQL = `(content_rating ~ '^[0-9]+$' 
             OR content_rating NOT IN ('G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR', 'Unrated'))`;

class RatingNormalizer {
  isStandardRating(rating, mediaType = 'movie') {
    if (!rating) {
      return false;
    }

    const standards = mediaType === 'tv' ? STANDARD_TV_RATINGS : STANDARD_MOVIE_RATINGS;
    return standards.includes(rating);
  }

  normalizeRating(rating, mediaType = 'movie') {
    if (!rating || rating === 'N/A') {
      return 'NR';
    }

    if (this.isStandardRating(rating, mediaType)) {
      return rating;
    }

    const map = mediaType === 'tv' ? AGE_TO_TV_MAP : AGE_TO_MPAA_MAP;
    return map[rating] || 'NR';
  }

  getPriorityRating(item) {
    if (item.metadata?.omdb?.data?.rated && item.metadata.omdb.data.rated !== 'N/A') {
      return item.metadata.omdb.data.rated;
    }

    if (item.metadata?.tmdb?.certification) {
      return item.metadata.tmdb.certification;
    }

    if (item.content_rating) {
      return this.normalizeRating(item.content_rating, item.media_type);
    }

    return 'NR';
  }

  getNeedsNormalizationSQL() {
    return NEEDS_NORMALIZATION_SQL;
  }
}

const ratingNormalizer = new RatingNormalizer();

module.exports = require('./ratingNormalizer.shared');
