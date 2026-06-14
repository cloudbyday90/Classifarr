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
  'TV-Y': 'G',
  'TV-Y7': 'PG',
  'TV-Y7-FV': 'PG',
  'TV-G': 'G',
  'TV-PG': 'PG',
  'TV-14': 'PG-13',
  'TV-MA': 'R',
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
  G: 'TV-G',
  PG: 'TV-PG',
  'PG-13': 'TV-14',
  R: 'TV-MA',
  'NC-17': 'TV-MA',
};

const STANDARD_MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'Unrated'];
const STANDARD_TV_RATINGS = ['TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

const ALL_STANDARDS = [...STANDARD_MOVIE_RATINGS, ...STANDARD_TV_RATINGS];
const NEEDS_NORMALIZATION_SQL = `(content_rating ~ '^[0-9]+$'
             OR content_rating NOT IN (${ALL_STANDARDS.map(r => `'${r}'`).join(', ')}))`;

class RatingNormalizer {
  isStandardRating(rating, mediaType = 'movie') {
    if (!rating) {
      return false;
    }

    const standards = mediaType === 'tv' ? STANDARD_TV_RATINGS : STANDARD_MOVIE_RATINGS;
    const normalizedInput = rating.trim().toUpperCase();
    return standards.some(s => s.toUpperCase() === normalizedInput);
  }

  normalizeRating(rating, mediaType = 'movie') {
    if (!rating) {
      return 'NR';
    }

    const trimmed = rating.trim();
    if (trimmed === 'N/A' || trimmed === '') {
      return 'NR';
    }

    const standards = mediaType === 'tv' ? STANDARD_TV_RATINGS : STANDARD_MOVIE_RATINGS;
    const upperTrimmed = trimmed.toUpperCase();
    const standardMatch = standards.find(s => s.toUpperCase() === upperTrimmed);
    if (standardMatch) {
      return standardMatch;
    }

    const map = mediaType === 'tv' ? AGE_TO_TV_MAP : AGE_TO_MPAA_MAP;
    return map[upperTrimmed] || 'NR';
  }

  getPriorityRating(item) {
    if (item.metadata?.omdb?.data?.rated && item.metadata.omdb.data.rated !== 'N/A') {
      return this.normalizeRating(item.metadata.omdb.data.rated, item.media_type);
    }

    if (item.metadata?.tmdb?.certification) {
      return this.normalizeRating(item.metadata.tmdb.certification, item.media_type);
    }

    if (item.content_rating) {
      return this.normalizeRating(item.content_rating, item.media_type);
    }

    return 'NR';
  }

  getNeedsNormalizationSQL() {
    return NEEDS_NORMALIZATION_SQL;
  }

  buildSqlCaseStatement(mediaType = 'movie', columnExpr) {
    const map = mediaType === 'tv' ? AGE_TO_TV_MAP : AGE_TO_MPAA_MAP;
    const standards = mediaType === 'tv' ? STANDARD_TV_RATINGS : STANDARD_MOVIE_RATINGS;
    const escapeSql = (str) => str.replace(/'/g, "''");

    const trimmedUpperExpr = `UPPER(TRIM(${columnExpr}))`;

    const standardCases = standards
      .map(r => `WHEN ${trimmedUpperExpr} = '${escapeSql(r.toUpperCase())}' THEN '${escapeSql(r)}'`)
      .join('\n      ');

    const cases = Object.entries(map)
      .map(([key, value]) => `WHEN ${trimmedUpperExpr} = '${escapeSql(key.toUpperCase())}' THEN '${escapeSql(value)}'`)
      .join('\n      ');

    return `CASE
      WHEN ${columnExpr} IS NULL OR TRIM(BOTH ' ' FROM ${columnExpr}) = '' OR TRIM(BOTH ' ' FROM ${columnExpr}) = 'N/A' THEN 'NR'
      ${standardCases}
      ${cases}
      ELSE 'NR'
    END`;
  }

  getNormalizedMetadataRatingSQL(metadataExpr, mediaTypeExpr) {
    const movieCase = this.buildSqlCaseStatement('movie', metadataExpr);
    const tvCase = this.buildSqlCaseStatement('tv', metadataExpr);
    return `CASE WHEN ${mediaTypeExpr} = 'tv' THEN ${tvCase} ELSE ${movieCase} END`;
  }
}

export const ratingNormalizer = new RatingNormalizer();

export { NEEDS_NORMALIZATION_SQL, RatingNormalizer };
