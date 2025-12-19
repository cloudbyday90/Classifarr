const classificationService = require('../services/classification');

describe('ClassificationService - metadataMatchesLabel', () => {
  describe('Genre Matching', () => {
    test('should match when metadata genre matches label value', () => {
      const metadata = {
        genres: ['Action', 'Adventure', 'Sci-Fi']
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should not match when metadata genre does not match label value', () => {
      const metadata = {
        genres: ['Action', 'Adventure']
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['horror']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when metadata genres is null', () => {
      const metadata = {
        genres: null
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when metadata genres is not an array', () => {
      const metadata = {
        genres: 'Action'
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when metadata genres is empty array', () => {
      const metadata = {
        genres: []
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });
  });

  describe('Certification/Rating Matching', () => {
    test('should match when metadata certification matches label value', () => {
      const metadata = {
        certification: 'PG-13'
      };
      const label = {
        tmdb_match_field: 'certification',
        tmdb_match_values: ['pg-13']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should match certification case-insensitively', () => {
      const metadata = {
        certification: 'R'
      };
      const label = {
        tmdb_match_field: 'certification',
        tmdb_match_values: ['r']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should not match when certification does not match', () => {
      const metadata = {
        certification: 'G'
      };
      const label = {
        tmdb_match_field: 'certification',
        tmdb_match_values: ['r', 'pg-13']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when certification is null', () => {
      const metadata = {
        certification: null
      };
      const label = {
        tmdb_match_field: 'certification',
        tmdb_match_values: ['pg-13']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });
  });

  describe('Keyword Matching', () => {
    test('should match when metadata keyword matches label value', () => {
      const metadata = {
        keywords: ['superhero', 'marvel', 'action']
      };
      const label = {
        tmdb_match_field: 'keywords',
        tmdb_match_values: ['superhero']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should match keywords case-insensitively', () => {
      const metadata = {
        keywords: ['SuperHero', 'Marvel']
      };
      const label = {
        tmdb_match_field: 'keywords',
        tmdb_match_values: ['superhero']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should not match when no keywords match', () => {
      const metadata = {
        keywords: ['action', 'adventure']
      };
      const label = {
        tmdb_match_field: 'keywords',
        tmdb_match_values: ['horror', 'scary']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when keywords is null', () => {
      const metadata = {
        keywords: null
      };
      const label = {
        tmdb_match_field: 'keywords',
        tmdb_match_values: ['superhero']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when keywords is empty array', () => {
      const metadata = {
        keywords: []
      };
      const label = {
        tmdb_match_field: 'keywords',
        tmdb_match_values: ['superhero']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });
  });

  describe('Language Matching', () => {
    test('should match when original language matches label value', () => {
      const metadata = {
        original_language: 'en'
      };
      const label = {
        tmdb_match_field: 'original_language',
        tmdb_match_values: ['en']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should match language case-insensitively', () => {
      const metadata = {
        original_language: 'JA'
      };
      const label = {
        tmdb_match_field: 'original_language',
        tmdb_match_values: ['ja']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });

    test('should not match when language does not match', () => {
      const metadata = {
        original_language: 'en'
      };
      const label = {
        tmdb_match_field: 'original_language',
        tmdb_match_values: ['ja', 'ko']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when original_language is null', () => {
      const metadata = {
        original_language: null
      };
      const label = {
        tmdb_match_field: 'original_language',
        tmdb_match_values: ['en']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should return false when tmdb_match_field is not defined', () => {
      const metadata = {
        genres: ['Action']
      };
      const label = {
        tmdb_match_field: null,
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when tmdb_match_values is not defined', () => {
      const metadata = {
        genres: ['Action']
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: null
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false when tmdb_match_values is empty array', () => {
      const metadata = {
        genres: ['Action']
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: []
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should return false for unknown match field', () => {
      const metadata = {
        genres: ['Action']
      };
      const label = {
        tmdb_match_field: 'unknown_field',
        tmdb_match_values: ['action']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
    });

    test('should handle multiple matching values', () => {
      const metadata = {
        genres: ['Action', 'Comedy']
      };
      const label = {
        tmdb_match_field: 'genres',
        tmdb_match_values: ['horror', 'comedy', 'thriller']
      };
      
      expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
    });
  });
});
