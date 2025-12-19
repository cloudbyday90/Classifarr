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

const contentTypeAnalyzer = require('../services/contentTypeAnalyzer');

describe('ContentTypeAnalyzer', () => {
  describe('Stand-up Comedy Detection', () => {
    test('should detect stand-up comedy from keywords', () => {
      const metadata = {
        title: 'Dave Chappelle: Sticks & Stones',
        overview: 'A stand-up comedy special recorded live at a comedy club',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'standup',
        contentTypeAnalyzer.patterns.standup,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.suggestedLabels).toContain('standup');
    });

    test('should not detect stand-up for regular comedy movie', () => {
      const metadata = {
        title: 'The Hangover',
        overview: 'A comedy about a bachelor party gone wrong',
        genres: ['Comedy'],
        keywords: ['bachelor party', 'las vegas'],
        certification: 'R',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'standup',
        contentTypeAnalyzer.patterns.standup,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(false);
    });
  });

  describe('Concert Film Detection', () => {
    test('should detect concert film from keywords and genres', () => {
      const metadata = {
        title: 'Taylor Swift: The Eras Tour',
        overview: 'A concert film capturing the live performance and tour',
        genres: ['Documentary', 'Music'],
        keywords: ['concert', 'live performance', 'tour'],
        certification: 'PG-13',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'concert',
        contentTypeAnalyzer.patterns.concert,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.suggestedLabels).toContain('concert');
    });
  });

  describe('Adult Animation Detection', () => {
    test('should detect adult animation with mature rating', () => {
      const metadata = {
        title: 'South Park',
        overview: 'An animated sitcom with adult humor',
        genres: ['Animation', 'Comedy'],
        keywords: ['adult animation', 'satire'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(60);
    });

    test('should not detect family animation as adult', () => {
      const metadata = {
        title: 'Toy Story',
        overview: 'A story about toys that come to life',
        genres: ['Animation', 'Family'],
        keywords: ['toys', 'adventure'],
        certification: 'G',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(false);
    });
  });

  describe('Anime Detection', () => {
    test('should detect anime from language and keywords', () => {
      const metadata = {
        title: 'Attack on Titan',
        overview: 'A Japanese anime about giant humanoids',
        genres: ['Animation', 'Action'],
        keywords: ['anime', 'based on manga', 'shounen'],
        certification: 'TV-MA',
        original_language: 'ja',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.suggestedLabels).toContain('anime');
    });
  });

  describe('K-Drama Detection', () => {
    test('should detect K-Drama from language and keywords', () => {
      const metadata = {
        title: 'Squid Game',
        overview: 'A Korean drama series about a survival game',
        genres: ['Drama', 'Thriller'],
        keywords: ['korean drama', 'k-drama'],
        certification: 'TV-MA',
        original_language: 'ko',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'kdrama',
        contentTypeAnalyzer.patterns.kdrama,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: metadata.genres.map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.suggestedLabels).toContain('kdrama');
    });
  });
});
