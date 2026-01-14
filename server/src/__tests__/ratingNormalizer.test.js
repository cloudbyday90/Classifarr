/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 */

const ratingNormalizer = require('../utils/ratingNormalizer');

describe('RatingNormalizer', () => {
  describe('isStandardRating', () => {
    test('recognizes standard movie ratings', () => {
      expect(ratingNormalizer.isStandardRating('G', 'movie')).toBe(true);
      expect(ratingNormalizer.isStandardRating('PG', 'movie')).toBe(true);
      expect(ratingNormalizer.isStandardRating('PG-13', 'movie')).toBe(true);
      expect(ratingNormalizer.isStandardRating('R', 'movie')).toBe(true);
      expect(ratingNormalizer.isStandardRating('NC-17', 'movie')).toBe(true);
      expect(ratingNormalizer.isStandardRating('NR', 'movie')).toBe(true);
    });

    test('recognizes standard TV ratings', () => {
      expect(ratingNormalizer.isStandardRating('TV-Y', 'tv')).toBe(true);
      expect(ratingNormalizer.isStandardRating('TV-Y7', 'tv')).toBe(true);
      expect(ratingNormalizer.isStandardRating('TV-G', 'tv')).toBe(true);
      expect(ratingNormalizer.isStandardRating('TV-PG', 'tv')).toBe(true);
      expect(ratingNormalizer.isStandardRating('TV-14', 'tv')).toBe(true);
      expect(ratingNormalizer.isStandardRating('TV-MA', 'tv')).toBe(true);
    });

    test('rejects non-standard ratings', () => {
      expect(ratingNormalizer.isStandardRating('13', 'movie')).toBe(false);
      expect(ratingNormalizer.isStandardRating('16', 'movie')).toBe(false);
      expect(ratingNormalizer.isStandardRating('FSK 16', 'movie')).toBe(false);
    });

    test('handles null/undefined ratings', () => {
      expect(ratingNormalizer.isStandardRating(null, 'movie')).toBe(false);
      expect(ratingNormalizer.isStandardRating(undefined, 'movie')).toBe(false);
      expect(ratingNormalizer.isStandardRating('', 'movie')).toBe(false);
    });
  });

  describe('normalizeRating - Age-based mappings', () => {
    test('normalizes age-based ratings to MPAA for movies', () => {
      expect(ratingNormalizer.normalizeRating('13', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('14', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('15', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('16', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('17', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('18', 'movie')).toBe('NC-17');
      expect(ratingNormalizer.normalizeRating('7', 'movie')).toBe('PG');
      expect(ratingNormalizer.normalizeRating('0', 'movie')).toBe('G');
      expect(ratingNormalizer.normalizeRating('6', 'movie')).toBe('G');
    });

    test('normalizes age-based ratings to TV ratings', () => {
      expect(ratingNormalizer.normalizeRating('7', 'tv')).toBe('TV-Y7');
      expect(ratingNormalizer.normalizeRating('10', 'tv')).toBe('TV-PG');
      expect(ratingNormalizer.normalizeRating('13', 'tv')).toBe('TV-14');
      expect(ratingNormalizer.normalizeRating('14', 'tv')).toBe('TV-14');
      expect(ratingNormalizer.normalizeRating('16', 'tv')).toBe('TV-MA');
      expect(ratingNormalizer.normalizeRating('18', 'tv')).toBe('TV-MA');
    });
  });

  describe('normalizeRating - International ratings', () => {
    test('normalizes UK ratings', () => {
      expect(ratingNormalizer.normalizeRating('U', 'movie')).toBe('G');
      expect(ratingNormalizer.normalizeRating('PG', 'movie')).toBe('PG');
      expect(ratingNormalizer.normalizeRating('12A', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('15', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('18', 'movie')).toBe('NC-17');
    });

    test('normalizes Australian ratings', () => {
      expect(ratingNormalizer.normalizeRating('G', 'movie')).toBe('G');
      expect(ratingNormalizer.normalizeRating('PG', 'movie')).toBe('PG');
      expect(ratingNormalizer.normalizeRating('M', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('MA15+', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('R18+', 'movie')).toBe('NC-17');
    });

    test('normalizes German FSK ratings', () => {
      expect(ratingNormalizer.normalizeRating('FSK 0', 'movie')).toBe('G');
      expect(ratingNormalizer.normalizeRating('FSK 6', 'movie')).toBe('G');
      expect(ratingNormalizer.normalizeRating('FSK 12', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('FSK 16', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('FSK 18', 'movie')).toBe('NC-17');
    });
  });

  describe('normalizeRating - Pass-through and defaults', () => {
    test('passes through already standard ratings', () => {
      expect(ratingNormalizer.normalizeRating('PG-13', 'movie')).toBe('PG-13');
      expect(ratingNormalizer.normalizeRating('R', 'movie')).toBe('R');
      expect(ratingNormalizer.normalizeRating('TV-14', 'tv')).toBe('TV-14');
      expect(ratingNormalizer.normalizeRating('TV-MA', 'tv')).toBe('TV-MA');
    });

    test('returns NR for unknown ratings', () => {
      expect(ratingNormalizer.normalizeRating('UNKNOWN', 'movie')).toBe('NR');
      expect(ratingNormalizer.normalizeRating('XXX', 'movie')).toBe('NR');
      expect(ratingNormalizer.normalizeRating('999', 'movie')).toBe('NR');
    });

    test('returns NR for null/N/A ratings', () => {
      expect(ratingNormalizer.normalizeRating(null, 'movie')).toBe('NR');
      expect(ratingNormalizer.normalizeRating(undefined, 'movie')).toBe('NR');
      expect(ratingNormalizer.normalizeRating('N/A', 'movie')).toBe('NR');
      expect(ratingNormalizer.normalizeRating('', 'movie')).toBe('NR');
    });
  });

  describe('getPriorityRating', () => {
    test('priority 1: OMDb rated field', () => {
      const item = {
        content_rating: '13',
        media_type: 'movie',
        metadata: {
          omdb: {
            data: {
              rated: 'PG-13'
            }
          },
          tmdb: {
            certification: 'R'
          }
        }
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('PG-13');
    });

    test('priority 2: TMDB certification when OMDb missing', () => {
      const item = {
        content_rating: '13',
        media_type: 'movie',
        metadata: {
          tmdb: {
            certification: 'R'
          }
        }
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('R');
    });

    test('priority 3: normalized content_rating when both missing', () => {
      const item = {
        content_rating: '16',
        media_type: 'movie',
        metadata: {}
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('R');
    });

    test('returns NR when all sources missing', () => {
      const item = {
        metadata: {}
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('NR');
    });

    test('ignores OMDb if rated is N/A', () => {
      const item = {
        content_rating: '13',
        media_type: 'movie',
        metadata: {
          omdb: {
            data: {
              rated: 'N/A'
            }
          },
          tmdb: {
            certification: 'PG-13'
          }
        }
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('PG-13');
    });

    test('handles TV shows with age ratings', () => {
      const item = {
        content_rating: '14',
        media_type: 'tv',
        metadata: {}
      };
      expect(ratingNormalizer.getPriorityRating(item)).toBe('TV-14');
    });
  });
});
