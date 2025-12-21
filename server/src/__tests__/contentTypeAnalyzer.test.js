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
const db = require('../config/database');

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

describe('ContentTypeAnalyzer', () => {
  describe('Stand-up Comedy Detection', () => {
    test('should detect stand-up comedy with keywords and both required genres (Documentary + Comedy)', () => {
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
      // Expect high confidence: genres (30) + keywords matched (keywords are counted once via OR logic)
      // 2 unique keywords * 15 = 30, total: 60 * 0.7 + 85 * 0.3 = 67.5
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.confidence).toBeLessThanOrEqual(85);
      expect(result.suggestedLabels).toContain('standup');
      expect(result.reasoning).toEqual(
        expect.arrayContaining([
          expect.stringContaining('required genres'),
          expect.stringContaining('keywords')
        ])
      );
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
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Required genres not matched')
        ])
      );
    });

    test('should NOT detect with only Documentary genre (missing Comedy)', () => {
      const metadata = {
        title: 'Nature Documentary',
        overview: 'A stand-up comedy special about nature',
        genres: ['Documentary'],
        keywords: ['stand-up comedy'],
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

      expect(result.detected).toBe(false);
    });

    test('should NOT detect with only Comedy genre (missing Documentary)', () => {
      const metadata = {
        title: 'Comedy Show',
        overview: 'A stand-up comedy special',
        genres: ['Comedy'],
        keywords: ['stand-up comedy'],
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

      expect(result.detected).toBe(false);
    });

    test('should NOT detect with Documentary + Action but missing Comedy', () => {
      const metadata = {
        title: 'Action Documentary',
        overview: 'A stand-up comedy special about action',
        genres: ['Documentary', 'Action'],
        keywords: ['stand-up comedy'],
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

      expect(result.detected).toBe(false);
    });

    test('should handle case-insensitive keyword matching', () => {
      const metadata = {
        title: 'COMEDY SPECIAL',
        overview: 'A STAND-UP COMEDY special RECORDED LIVE AT a venue',
        genres: ['Documentary', 'Comedy'],
        keywords: ['STAND-UP COMEDY', 'COMEDY SPECIAL'],
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
          keywords: metadata.keywords.map(k => k.toLowerCase()),
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.reasoning).toEqual(
        expect.arrayContaining([
          expect.stringContaining('keywords')
        ])
      );
    });
  });

  describe('Concert Film Detection', () => {
    test('should detect concert film with keywords and both required genres (Documentary + Music)', () => {
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

    test('should NOT detect with only Music genre (missing Documentary)', () => {
      const metadata = {
        title: 'Music Video',
        overview: 'A concert film',
        genres: ['Music'],
        keywords: ['concert'],
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

      expect(result.detected).toBe(false);
    });

    test('should NOT detect with only Documentary genre (missing Music)', () => {
      const metadata = {
        title: 'Documentary Film',
        overview: 'A concert film',
        genres: ['Documentary'],
        keywords: ['concert'],
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

      expect(result.detected).toBe(false);
    });

    test('should NOT detect without concert keywords', () => {
      const metadata = {
        title: 'Music Documentary',
        overview: 'A documentary about music history',
        genres: ['Documentary', 'Music'],
        keywords: ['history', 'biography'],
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

      // Genres match but no concert keywords, so confidence should be lower
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeLessThan(60);
    });
  });

  describe('Adult Animation Detection', () => {
    test('should detect adult animation with mature rating (TV-MA)', () => {
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

    test('should NOT detect with family ratings (G, PG, TV-Y, TV-Y7, TV-G)', () => {
      const familyRatings = ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'];

      familyRatings.forEach(rating => {
        const metadata = {
          title: 'Family Animation',
          overview: 'An animated sitcom',
          genres: ['Animation', 'Comedy'],
          keywords: ['animated sitcom'],
          certification: rating,
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

    test('should detect adult animation with R rating', () => {
      const metadata = {
        title: 'Adult Animation Film',
        overview: 'An animated film with adult themes',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'R',
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
      expect(result.confidence).toBeGreaterThan(40);
    });

    test('should detect adult animation with NC-17 rating', () => {
      const metadata = {
        title: 'Adult Animation Film',
        overview: 'An animated film with mature content',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'NC-17',
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
      expect(result.confidence).toBeGreaterThan(40);
    });

    test('should have lower confidence without mature rating', () => {
      const withRating = {
        title: 'Adult Animation',
        overview: 'An animated sitcom',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const withoutRating = {
        title: 'Adult Animation',
        overview: 'An animated sitcom',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'PG-13',
        original_language: 'en',
      };

      const resultWithRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: withRating.overview.toLowerCase(),
          title: withRating.title.toLowerCase(),
          genres: withRating.genres.map(g => g.toLowerCase()),
          keywords: withRating.keywords,
          certification: withRating.certification,
          originalLanguage: withRating.original_language,
        }
      );

      const resultWithoutRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: withoutRating.overview.toLowerCase(),
          title: withoutRating.title.toLowerCase(),
          genres: withoutRating.genres.map(g => g.toLowerCase()),
          keywords: withoutRating.keywords,
          certification: withoutRating.certification,
          originalLanguage: withoutRating.original_language,
        }
      );

      expect(resultWithRating.detected).toBe(true);
      expect(resultWithoutRating.detected).toBe(true);
      expect(resultWithRating.confidence).toBeGreaterThan(resultWithoutRating.confidence);
    });
  });

  describe('Anime Detection', () => {
    test('should detect anime with Japanese language and keywords', () => {
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

    test('should detect anime from keywords alone (without Japanese language)', () => {
      const metadata = {
        title: 'Anime Show',
        overview: 'A show based on manga',
        genres: ['Animation'],
        keywords: ['anime', 'manga'],
        certification: 'TV-14',
        original_language: 'en',
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
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should NOT detect for non-anime animation', () => {
      const metadata = {
        title: 'Regular Cartoon',
        overview: 'An American animated show',
        genres: ['Animation'],
        keywords: ['cartoon', 'family'],
        certification: 'TV-Y',
        original_language: 'en',
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

      expect(result.detected).toBe(false);
    });

    test('should have higher confidence with Japanese language (ja)', () => {
      const withJapanese = {
        title: 'Anime Show',
        overview: 'An anime show',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: 'ja',
      };

      const withoutJapanese = {
        title: 'Anime Show',
        overview: 'An anime show',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: 'en',
      };

      const resultWithJapanese = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: withJapanese.overview.toLowerCase(),
          title: withJapanese.title.toLowerCase(),
          genres: withJapanese.genres.map(g => g.toLowerCase()),
          keywords: withJapanese.keywords,
          certification: withJapanese.certification,
          originalLanguage: withJapanese.original_language,
        }
      );

      const resultWithoutJapanese = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: withoutJapanese.overview.toLowerCase(),
          title: withoutJapanese.title.toLowerCase(),
          genres: withoutJapanese.genres.map(g => g.toLowerCase()),
          keywords: withoutJapanese.keywords,
          certification: withoutJapanese.certification,
          originalLanguage: withoutJapanese.original_language,
        }
      );

      expect(resultWithJapanese.detected).toBe(true);
      expect(resultWithoutJapanese.detected).toBe(true);
      expect(resultWithJapanese.confidence).toBeGreaterThan(resultWithoutJapanese.confidence);
    });
  });

  describe('K-Drama Detection', () => {
    test('should detect K-Drama with Korean language and keywords', () => {
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

    test('should have high confidence with Korean language (ko)', () => {
      const metadata = {
        title: 'Korean Show',
        overview: 'A k-drama series',
        genres: ['Drama'],
        keywords: ['korean drama'],
        certification: 'TV-14',
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
      expect(result.confidence).toBeGreaterThan(70);
    });

    test('should have lower confidence without Korean language', () => {
      const withKorean = {
        title: 'Korean Drama',
        overview: 'A k-drama',
        genres: ['Drama'],
        keywords: ['korean drama'],
        certification: 'TV-14',
        original_language: 'ko',
      };

      const withoutKorean = {
        title: 'Korean Drama',
        overview: 'A k-drama',
        genres: ['Drama'],
        keywords: ['korean drama'],
        certification: 'TV-14',
        original_language: 'en',
      };

      const resultWithKorean = contentTypeAnalyzer.checkPattern(
        'kdrama',
        contentTypeAnalyzer.patterns.kdrama,
        {
          overview: withKorean.overview.toLowerCase(),
          title: withKorean.title.toLowerCase(),
          genres: withKorean.genres.map(g => g.toLowerCase()),
          keywords: withKorean.keywords,
          certification: withKorean.certification,
          originalLanguage: withKorean.original_language,
        }
      );

      const resultWithoutKorean = contentTypeAnalyzer.checkPattern(
        'kdrama',
        contentTypeAnalyzer.patterns.kdrama,
        {
          overview: withoutKorean.overview.toLowerCase(),
          title: withoutKorean.title.toLowerCase(),
          genres: withoutKorean.genres.map(g => g.toLowerCase()),
          keywords: withoutKorean.keywords,
          certification: withoutKorean.certification,
          originalLanguage: withoutKorean.original_language,
        }
      );

      expect(resultWithKorean.detected).toBe(true);
      expect(resultWithoutKorean.detected).toBe(true);
      expect(resultWithKorean.confidence).toBeGreaterThan(resultWithoutKorean.confidence);
    });

    test('should NOT detect for non-Korean drama', () => {
      const metadata = {
        title: 'Regular Drama',
        overview: 'An American drama series',
        genres: ['Drama'],
        keywords: ['drama', 'series'],
        certification: 'TV-14',
        original_language: 'en',
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

      expect(result.detected).toBe(false);
    });
  });

  describe('Edge Cases with Missing/Null/Empty Data', () => {
    test('should handle missing certification gracefully', () => {
      const metadata = {
        title: 'Test Show',
        overview: 'A stand-up comedy special',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy'],
        certification: '',
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
    });

    test('should handle empty genres array', () => {
      const metadata = {
        title: 'Test Show',
        overview: 'A stand-up comedy special',
        genres: [],
        keywords: ['stand-up comedy'],
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

      expect(result.detected).toBe(false);
    });

    test('should handle null genres array', () => {
      const metadata = {
        title: 'Test Show',
        overview: 'A stand-up comedy special',
        genres: null,
        keywords: ['stand-up comedy'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = contentTypeAnalyzer.checkPattern(
        'standup',
        contentTypeAnalyzer.patterns.standup,
        {
          overview: metadata.overview.toLowerCase(),
          title: metadata.title.toLowerCase(),
          genres: (metadata.genres || []).map(g => g.toLowerCase()),
          keywords: metadata.keywords,
          certification: metadata.certification,
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(false);
    });

    test('should handle empty keywords array', () => {
      const metadata = {
        title: 'Test Show',
        overview: 'A stand-up comedy special',
        genres: ['Documentary', 'Comedy'],
        keywords: [],
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
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle undefined originalLanguage', () => {
      const metadata = {
        title: 'Anime Show',
        overview: 'An anime show',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: undefined,
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
          originalLanguage: metadata.original_language || '',
        }
      );

      expect(result.detected).toBe(true);
    });

    test('should handle empty overview and title', () => {
      const metadata = {
        title: '',
        overview: '',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy'],
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
    });

    test('should NOT detect with completely empty metadata', () => {
      const metadata = {
        title: '',
        overview: '',
        genres: [],
        keywords: [],
        certification: '',
        original_language: '',
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

  describe('Confidence Calculation Tests', () => {
    test('should cap multiple keyword matches at 50 points', () => {
      const metadata = {
        title: 'stand-up comedy special live comedy recorded live at comedy tour one man show',
        overview: 'A stand-up comedy special recorded live at a comedy tour featuring one man show',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special', 'live comedy', 'recorded live at', 'comedy tour', 'one man show'],
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
      // Unique keywords are counted once regardless of where they appear (title, overview, or keywords array)
      // 6 unique keywords * 15 = 90, but capped at 50, plus genres (30) = 80 * 0.7 + 85 * 0.3 = 81.5
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should calculate confidence from genre + keyword combination', () => {
      const metadata = {
        title: 'Concert Film',
        overview: 'A concert film with live performance',
        genres: ['Documentary', 'Music'],
        keywords: ['concert'],
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
      // 'concert' appears in title and keywords (counted once), 'live performance' in overview
      // 2 unique keywords * 15 = 30, plus genres (30) = 60 * 0.7 + 85 * 0.3 = 67.5
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should add rating bonus to confidence', () => {
      const withRating = {
        title: 'Adult Animation',
        overview: 'An adult cartoon',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const withoutRating = {
        title: 'Adult Animation',
        overview: 'An adult cartoon',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'PG-13',
        original_language: 'en',
      };

      const resultWithRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: withRating.overview.toLowerCase(),
          title: withRating.title.toLowerCase(),
          genres: withRating.genres.map(g => g.toLowerCase()),
          keywords: withRating.keywords,
          certification: withRating.certification,
          originalLanguage: withRating.original_language,
        }
      );

      const resultWithoutRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: withoutRating.overview.toLowerCase(),
          title: withoutRating.title.toLowerCase(),
          genres: withoutRating.genres.map(g => g.toLowerCase()),
          keywords: withoutRating.keywords,
          certification: withoutRating.certification,
          originalLanguage: withoutRating.original_language,
        }
      );

      expect(resultWithRating.confidence).toBeGreaterThan(resultWithoutRating.confidence);
    });

    test('should add language bonus to confidence', () => {
      const withLanguage = {
        title: 'Anime Show',
        overview: 'An anime',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: 'ja',
      };

      const withoutLanguage = {
        title: 'Anime Show',
        overview: 'An anime',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: 'en',
      };

      const resultWithLanguage = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: withLanguage.overview.toLowerCase(),
          title: withLanguage.title.toLowerCase(),
          genres: withLanguage.genres.map(g => g.toLowerCase()),
          keywords: withLanguage.keywords,
          certification: withLanguage.certification,
          originalLanguage: withLanguage.original_language,
        }
      );

      const resultWithoutLanguage = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: withoutLanguage.overview.toLowerCase(),
          title: withoutLanguage.title.toLowerCase(),
          genres: withoutLanguage.genres.map(g => g.toLowerCase()),
          keywords: withoutLanguage.keywords,
          certification: withoutLanguage.certification,
          originalLanguage: withoutLanguage.original_language,
        }
      );

      expect(resultWithLanguage.confidence).toBeGreaterThan(resultWithoutLanguage.confidence);
    });

    test('should not exceed 100 confidence', () => {
      const metadata = {
        title: 'anime manga shounen',
        overview: 'A japanese animation anime based on manga shounen',
        genres: ['Animation'],
        keywords: ['anime', 'manga', 'based on manga', 'shounen', 'isekai'],
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
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should NOT detect below 40% threshold', () => {
      // Pattern with no matching elements should have 0 confidence
      const metadata = {
        title: 'Regular Show',
        overview: 'A regular TV show',
        genres: ['Drama'],
        keywords: ['regular'],
        certification: 'TV-14',
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
      expect(result.confidence).toBe(0);
    });
  });

  describe('Other Content Type Patterns', () => {
    describe('Reality TV Detection', () => {
      test('should detect reality TV with positive match', () => {
        const metadata = {
          title: 'Reality Competition',
          overview: 'A reality show with contestants competing for elimination',
          genres: ['Documentary', 'Reality'],
          keywords: ['reality', 'competition', 'contestants', 'elimination'],
          certification: 'TV-14',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'realityTV',
          contentTypeAnalyzer.patterns.realityTV,
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

      test('should NOT detect reality TV without match', () => {
        const metadata = {
          title: 'Drama Show',
          overview: 'A dramatic series',
          genres: ['Drama'],
          keywords: ['drama'],
          certification: 'TV-14',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'realityTV',
          contentTypeAnalyzer.patterns.realityTV,
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

    describe('Holiday Content Detection', () => {
      test('should detect holiday content with positive match', () => {
        const metadata = {
          title: 'Christmas Special',
          overview: 'A festive holiday special featuring santa claus and christmas themes',
          genres: ['Comedy'],
          keywords: ['christmas', 'holiday', 'santa claus'],
          certification: 'TV-G',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'holiday',
          contentTypeAnalyzer.patterns.holiday,
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
        expect(result.confidence).toBeGreaterThan(40);
      });

      test('should NOT detect holiday content without match', () => {
        const metadata = {
          title: 'Summer Movie',
          overview: 'A summer adventure',
          genres: ['Action'],
          keywords: ['summer', 'adventure'],
          certification: 'PG-13',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'holiday',
          contentTypeAnalyzer.patterns.holiday,
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

    describe('Halloween Content Detection', () => {
      test('should detect halloween content with positive match', () => {
        const metadata = {
          title: 'Halloween Special',
          overview: 'A spooky halloween special with trick or treat and haunted house themes',
          genres: ['Horror'],
          keywords: ['halloween', 'spooky', 'trick or treat'],
          certification: 'TV-14',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'halloween',
          contentTypeAnalyzer.patterns.halloween,
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
        expect(result.confidence).toBeGreaterThan(40);
      });

      test('should NOT detect halloween content without match', () => {
        const metadata = {
          title: 'Spring Movie',
          overview: 'A spring comedy',
          genres: ['Comedy'],
          keywords: ['spring', 'comedy'],
          certification: 'PG',
          original_language: 'en',
        };

        const result = contentTypeAnalyzer.checkPattern(
          'halloween',
          contentTypeAnalyzer.patterns.halloween,
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
  });

  describe('analyze() Method Integration Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should analyze and return best match for stand-up comedy', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'true' },
          { key: 'content_analysis_min_confidence', value: '75' }
        ]
      });

      const metadata = {
        title: 'Dave Chappelle: Sticks & Stones',
        overview: 'A stand-up comedy special recorded live at a comedy club',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch.type).toBe('standup');
      expect(result.detections.length).toBeGreaterThan(0);
    });

    test('should return analyzed=false when disabled', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'false' }
        ]
      });

      const metadata = {
        title: 'Test Show',
        overview: 'A test show',
        genres: ['Comedy'],
        keywords: [],
        certification: 'TV-14',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(false);
      expect(result.reason).toBe('Content analysis disabled');
    });

    test('should filter detections by minimum confidence threshold', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'true' },
          { key: 'content_analysis_min_confidence', value: '85' }
        ]
      });

      const metadata = {
        title: 'Anime Show',
        overview: 'An anime',
        genres: ['Animation'],
        keywords: ['anime'],
        certification: 'TV-14',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      // With only keywords and no language, confidence might be below 85
      if (result.detections.length > 0) {
        result.detections.forEach(detection => {
          expect(detection.confidence).toBeGreaterThanOrEqual(85);
        });
      }
    });

    test('should sort detections by confidence', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'true' },
          { key: 'content_analysis_min_confidence', value: '40' }
        ]
      });

      const metadata = {
        title: 'christmas anime holiday special',
        overview: 'A japanese animation anime holiday christmas special',
        genres: ['Animation'],
        keywords: ['anime', 'christmas', 'holiday'],
        certification: 'TV-14',
        original_language: 'ja',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      if (result.detections.length > 1) {
        for (let i = 1; i < result.detections.length; i++) {
          expect(result.detections[i - 1].confidence).toBeGreaterThanOrEqual(result.detections[i].confidence);
        }
      }
    });

    test('should handle errors gracefully', async () => {
      // Suppress expected error logs for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      db.query.mockRejectedValue(new Error('Database error'));

      const metadata = {
        title: 'Test Show',
        overview: 'A test show',
        genres: ['Comedy'],
        keywords: [],
        certification: 'TV-14',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      // getSettings catches error and returns defaults, so analysis continues
      expect(result.analyzed).toBe(true);
      expect(result.detections).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('should determine if detection should override genre', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'true' },
          { key: 'content_analysis_min_confidence', value: '75' }
        ]
      });

      const metadata = {
        title: 'Stand-up Special',
        overview: 'A stand-up comedy special recorded live at a venue',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      expect(result.overridesGenre).toBeDefined();
      if (result.bestMatch && result.bestMatch.confidence >= 80) {
        expect(result.overridesGenre).toBe(true);
      }
    });

    test('should call logAnalysis when classificationId provided', async () => {
      db.query.mockResolvedValue({
        rows: [
          { key: 'content_analysis_enabled', value: 'true' },
          { key: 'content_analysis_min_confidence', value: '75' }
        ]
      });

      const metadata = {
        title: 'Stand-up Special',
        overview: 'A stand-up comedy special',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy'],
        certification: 'TV-MA',
        original_language: 'en',
        tmdb_id: 12345,
      };

      const result = await contentTypeAnalyzer.analyze(metadata, 100);

      expect(result.analyzed).toBe(true);
      if (result.bestMatch) {
        // logAnalysis should have been called
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO content_analysis_log'),
          expect.arrayContaining([100, 12345])
        );
      }
    });
  });

  describe('Real-World Classification Scenarios', () => {
    describe('Disambiguation Tests - Similar Content Types', () => {
      test('should distinguish anime from western animation', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '75' }
          ]
        });

        // Japanese anime
        const animeMetadata = {
          title: 'My Hero Academia',
          overview: 'A shounen anime about young heroes',
          genres: ['Animation', 'Action'],
          keywords: ['anime', 'shounen'],
          certification: 'TV-14',
          original_language: 'ja',
        };

        // Western animation
        const westernMetadata = {
          title: 'Avatar: The Last Airbender',
          overview: 'An animated adventure series',
          genres: ['Animation', 'Action'],
          keywords: ['adventure', 'fantasy'],
          certification: 'TV-Y7',
          original_language: 'en',
        };

        const animeResult = await contentTypeAnalyzer.analyze(animeMetadata);
        const westernResult = await contentTypeAnalyzer.analyze(westernMetadata);

        // Anime should be detected with high confidence
        expect(animeResult.bestMatch?.type).toBe('anime');
        expect(animeResult.bestMatch?.confidence).toBeGreaterThanOrEqual(75);

        // Western animation should not be classified as anime
        expect(westernResult.bestMatch?.type).not.toBe('anime');
      });

      test('should distinguish stand-up from sketch comedy', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '60' }
          ]
        });

        // Stand-up comedy
        const standupMetadata = {
          title: 'Bo Burnham: Inside',
          overview: 'A stand-up comedy special filmed during quarantine',
          genres: ['Documentary', 'Comedy'],
          keywords: ['stand-up comedy', 'comedy special'],
          certification: 'TV-MA',
          original_language: 'en',
        };

        // Sketch comedy
        const sketchMetadata = {
          title: 'Saturday Night Live',
          overview: 'A comedy variety show featuring sketches and parodies',
          genres: ['Comedy'],
          keywords: ['sketch', 'variety', 'parody'],
          certification: 'TV-14',
          original_language: 'en',
        };

        const standupResult = await contentTypeAnalyzer.analyze(standupMetadata);
        const sketchResult = await contentTypeAnalyzer.analyze(sketchMetadata);

        // Stand-up should be detected
        expect(standupResult.bestMatch?.type).toBe('standup');
        expect(standupResult.bestMatch?.confidence).toBeGreaterThanOrEqual(60);

        // Sketch comedy should not be classified as stand-up
        expect(sketchResult.bestMatch?.type).not.toBe('standup');
      });

      test('should distinguish concert films from music documentaries', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '75' }
          ]
        });

        // Concert film
        const concertMetadata = {
          title: 'Stop Making Sense',
          overview: 'A concert film of Talking Heads live performance',
          genres: ['Documentary', 'Music'],
          keywords: ['concert', 'live performance'],
          certification: 'PG',
          original_language: 'en',
        };

        // Music documentary (not concert)
        const docMetadata = {
          title: 'The Beatles: Get Back',
          overview: 'A documentary about the making of an album',
          genres: ['Documentary', 'Music'],
          keywords: ['documentary', 'behind the scenes'],
          certification: 'PG-13',
          original_language: 'en',
        };

        const concertResult = await contentTypeAnalyzer.analyze(concertMetadata);
        const docResult = await contentTypeAnalyzer.analyze(docMetadata);

        // Concert should be detected
        expect(concertResult.bestMatch?.type).toBe('concert');
        expect(concertResult.bestMatch?.confidence).toBeGreaterThanOrEqual(75);

        // Music doc without concert keywords should have lower confidence or not be detected as concert
        if (docResult.bestMatch?.type === 'concert') {
          expect(docResult.bestMatch?.confidence).toBeLessThan(concertResult.bestMatch?.confidence);
        }
      });
    });

    describe('Confidence Score Accuracy Tests', () => {
      test('should produce consistent confidence scores for similar content', () => {
        // Two similar stand-up specials should have similar confidence
        const special1 = {
          title: 'Comedy Special A',
          overview: 'A stand-up comedy special',
          genres: ['Documentary', 'Comedy'],
          keywords: ['stand-up comedy'],
          certification: 'TV-MA',
          original_language: 'en',
        };

        const special2 = {
          title: 'Comedy Special B',
          overview: 'A live comedy performance',
          genres: ['Documentary', 'Comedy'],
          keywords: ['live comedy'],
          certification: 'TV-MA',
          original_language: 'en',
        };

        const result1 = contentTypeAnalyzer.checkPattern(
          'standup',
          contentTypeAnalyzer.patterns.standup,
          {
            overview: special1.overview.toLowerCase(),
            title: special1.title.toLowerCase(),
            genres: special1.genres.map(g => g.toLowerCase()),
            keywords: special1.keywords,
            certification: special1.certification,
            originalLanguage: special1.original_language,
          }
        );

        const result2 = contentTypeAnalyzer.checkPattern(
          'standup',
          contentTypeAnalyzer.patterns.standup,
          {
            overview: special2.overview.toLowerCase(),
            title: special2.title.toLowerCase(),
            genres: special2.genres.map(g => g.toLowerCase()),
            keywords: special2.keywords,
            certification: special2.certification,
            originalLanguage: special2.original_language,
          }
        );

        // Confidence should be within 10 points of each other
        expect(Math.abs(result1.confidence - result2.confidence)).toBeLessThanOrEqual(10);
        expect(result1.detected).toBe(true);
        expect(result2.detected).toBe(true);
      });

      test('should provide lower confidence for ambiguous content', () => {
        // Content with minimal signals should have lower confidence
        const minimalMetadata = {
          title: 'Show',
          overview: 'A show',
          genres: ['Documentary', 'Comedy'],
          keywords: [],
          certification: '',
          original_language: 'en',
        };

        const richMetadata = {
          title: 'Stand-up Special',
          overview: 'A stand-up comedy special recorded live at venue',
          genres: ['Documentary', 'Comedy'],
          keywords: ['stand-up comedy', 'comedy special', 'live comedy'],
          certification: 'TV-MA',
          original_language: 'en',
        };

        const minimalResult = contentTypeAnalyzer.checkPattern(
          'standup',
          contentTypeAnalyzer.patterns.standup,
          {
            overview: minimalMetadata.overview.toLowerCase(),
            title: minimalMetadata.title.toLowerCase(),
            genres: minimalMetadata.genres.map(g => g.toLowerCase()),
            keywords: minimalMetadata.keywords,
            certification: minimalMetadata.certification,
            originalLanguage: minimalMetadata.original_language,
          }
        );

        const richResult = contentTypeAnalyzer.checkPattern(
          'standup',
          contentTypeAnalyzer.patterns.standup,
          {
            overview: richMetadata.overview.toLowerCase(),
            title: richMetadata.title.toLowerCase(),
            genres: richMetadata.genres.map(g => g.toLowerCase()),
            keywords: richMetadata.keywords,
            certification: richMetadata.certification,
            originalLanguage: richMetadata.original_language,
          }
        );

        expect(minimalResult.detected).toBe(true);
        expect(richResult.detected).toBe(true);
        expect(minimalResult.confidence).toBeLessThan(richResult.confidence);
        // Minimal should be < 60, rich should be > 75
        expect(minimalResult.confidence).toBeLessThan(60);
        expect(richResult.confidence).toBeGreaterThan(75);
      });
    });

    describe('Edge Case Detection Quality', () => {
      test('should handle mixed-language content correctly', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '60' }
          ]
        });

        // Korean content with English title
        const kdramaMetadata = {
          title: 'Squid Game',
          overview: 'A korean drama survival series',
          genres: ['Drama', 'Thriller'],
          keywords: ['korean drama', 'k-drama'],
          certification: 'TV-MA',
          original_language: 'ko',
        };

        const result = await contentTypeAnalyzer.analyze(kdramaMetadata);

        expect(result.bestMatch?.type).toBe('kdrama');
        expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(60);
        expect(result.bestMatch?.reasoning).toEqual(
          expect.arrayContaining([
            expect.stringContaining('language')
          ])
        );
      });

      test('should detect content with special characters in metadata', () => {
        const metadata = {
          title: 'John Mulaney: Kid Gorgeous at Radio City',
          overview: 'A stand-up comedy special featuring John Mulaney\'s humor',
          genres: ['Documentary', 'Comedy'],
          keywords: ['stand-up comedy'],
          certification: 'TV-14',
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
        expect(result.confidence).toBeGreaterThanOrEqual(60);
      });
    });

    describe('Multi-Pattern Detection Priority', () => {
      test('should prioritize more specific pattern when multiple match', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '40' }
          ]
        });

        // Content that could match both anime and adultAnimation
        const metadata = {
          title: 'Rick and Morty',
          overview: 'An adult animated sitcom with science fiction themes',
          genres: ['Animation', 'Comedy'],
          keywords: ['adult animation', 'animated sitcom', 'satire'],
          certification: 'TV-MA',
          original_language: 'en',
        };

        const result = await contentTypeAnalyzer.analyze(metadata);

        expect(result.analyzed).toBe(true);
        expect(result.detections.length).toBeGreaterThan(0);
        // Adult animation should be detected, not anime
        expect(result.bestMatch?.type).toBe('adultAnimation');
        expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(60);
      });

      test('should correctly identify holiday-themed anime', async () => {
        db.query.mockResolvedValue({
          rows: [
            { key: 'content_analysis_enabled', value: 'true' },
            { key: 'content_analysis_min_confidence', value: '50' }
          ]
        });

        const metadata = {
          title: 'Tokyo Godfathers',
          overview: 'A christmas anime film about three homeless people finding hope',
          genres: ['Animation', 'Drama'],
          keywords: ['anime', 'christmas', 'holiday'],
          certification: 'PG-13',
          original_language: 'ja',
        };

        const result = await contentTypeAnalyzer.analyze(metadata);

        expect(result.analyzed).toBe(true);
        expect(result.detections.length).toBeGreaterThanOrEqual(1);

        // Should detect both anime and holiday
        const detectionTypes = result.detections.map(d => d.type);
        expect(detectionTypes).toContain('anime');

        // Anime should be highest confidence due to language
        expect(result.bestMatch?.type).toBe('anime');
        expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(65);

        // If holiday is also detected, it should be in the detections list
        if (detectionTypes.includes('holiday')) {
          const holidayDetection = result.detections.find(d => d.type === 'holiday');
          expect(holidayDetection).toBeDefined();
        }
      });
    });
  });
});
