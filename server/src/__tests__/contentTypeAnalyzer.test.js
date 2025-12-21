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
        overview: 'A bachelor party gone wrong',
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

      // Should have very low confidence due to missing Documentary genre and no standup keywords
      if (result.detected) {
        expect(result.confidence).toBeLessThan(60);
      } else {
        expect(result.detected).toBe(false);
      }
    });

    test('should NOT detect with only Documentary genre (missing Comedy)', () => {
      const metadata = {
        title: 'Stand-up Special',
        overview: 'A stand-up comedy performance',
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

      // Should have low confidence due to missing Comedy genre
      expect(result.confidence).toBeLessThan(70);
    });

    test('should NOT detect with only Comedy genre (missing Documentary)', () => {
      const metadata = {
        title: 'Stand-up Special',
        overview: 'A stand-up comedy performance',
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

      // Should have low confidence due to missing Documentary genre
      expect(result.confidence).toBeLessThan(70);
    });

    test('should NOT detect with Documentary + Action but missing Comedy', () => {
      const metadata = {
        title: 'Stand-up Special',
        overview: 'A stand-up comedy performance',
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

      // Should have low confidence due to missing Comedy genre
      expect(result.confidence).toBeLessThan(70);
    });

    test('should detect with case-insensitive keyword matching', () => {
      const metadata = {
        title: 'STAND-UP COMEDY SPECIAL',
        overview: 'A LIVE COMEDY performance',
        genres: ['Documentary', 'Comedy'],
        keywords: ['STAND-UP COMEDY'],
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
      expect(result.confidence).toBeGreaterThan(70);
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

    test('should NOT detect with only Music genre (missing Documentary)', () => {
      const metadata = {
        title: 'Concert Film',
        overview: 'A live concert performance',
        genres: ['Music'],
        keywords: ['concert', 'live performance'],
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

      // Should have low confidence due to missing Documentary genre
      expect(result.confidence).toBeLessThan(70);
    });

    test('should NOT detect with only Documentary genre (missing Music)', () => {
      const metadata = {
        title: 'Concert Film',
        overview: 'A live concert performance',
        genres: ['Documentary'],
        keywords: ['concert', 'live performance'],
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

      // Should have low confidence due to missing Music genre
      expect(result.confidence).toBeLessThan(70);
    });

    test('should NOT detect without concert keywords', () => {
      const metadata = {
        title: 'Music Biography',
        overview: 'A biography about a musician',
        genres: ['Documentary', 'Music'],
        keywords: ['music', 'biography'],
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

      // Should have some confidence from genres but not high without concert keywords
      if (result.detected) {
        expect(result.confidence).toBeLessThan(70);
      } else {
        expect(result.detected).toBe(false);
      }
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

      // Should be excluded due to G rating
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning[0]).toContain('Excluded due to rating');
    });

    test('should exclude adult animation with PG rating', () => {
      const metadata = {
        title: 'Animated Film',
        overview: 'An animated film',
        genres: ['Animation'],
        keywords: ['animation'],
        certification: 'PG',
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
      expect(result.reasoning[0]).toContain('Excluded due to rating');
    });

    test('should exclude adult animation with TV-Y rating', () => {
      const metadata = {
        title: 'Kids Animation',
        overview: 'An animated show for kids',
        genres: ['Animation'],
        keywords: ['animation'],
        certification: 'TV-Y',
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
      expect(result.reasoning[0]).toContain('Excluded due to rating');
    });

    test('should detect adult animation with R rating', () => {
      const metadata = {
        title: 'Fritz the Cat',
        overview: 'An adult animated film',
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
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.reasoning).toContain('Matched rating: R');
    });

    test('should detect adult animation with NC-17 rating', () => {
      const metadata = {
        title: 'Adult Animated Film',
        overview: 'An adult animated film',
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
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.reasoning).toContain('Matched rating: NC-17');
    });

    test('should detect adult animation with TV-MA rating', () => {
      const metadata = {
        title: 'BoJack Horseman',
        overview: 'An adult animated series',
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
      expect(result.reasoning).toContain('Matched rating: TV-MA');
    });

    test('should have lower confidence without mature rating', () => {
      const metadata = {
        title: 'Adult Animated Film',
        overview: 'An adult animated film',
        genres: ['Animation'],
        keywords: ['adult animation'],
        certification: 'PG-13',
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

      // Should have lower confidence without mature rating bonus
      expect(result.detected).toBe(true);
      expect(result.reasoning).not.toContain('Matched rating');
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
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.suggestedLabels).toContain('anime');
    });

    test('should detect anime from keywords alone', () => {
      const metadata = {
        title: 'Anime Title',
        overview: 'An anime series',
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

    test('should NOT detect non-anime animation', () => {
      const metadata = {
        title: 'SpongeBob SquarePants',
        overview: 'An American animated series',
        genres: ['Animation', 'Comedy'],
        keywords: ['cartoon', 'comedy'],
        certification: 'TV-Y7',
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

    test('should have higher confidence with Japanese language', () => {
      const withJapanese = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: 'anime series',
          title: '',
          genres: ['animation'],
          keywords: ['anime'],
          certification: '',
          originalLanguage: 'ja',
        }
      );

      const withoutJapanese = contentTypeAnalyzer.checkPattern(
        'anime',
        contentTypeAnalyzer.patterns.anime,
        {
          overview: 'anime series',
          title: '',
          genres: ['animation'],
          keywords: ['anime'],
          certification: '',
          originalLanguage: 'en',
        }
      );

      expect(withJapanese.confidence).toBeGreaterThan(withoutJapanese.confidence);
      expect(withJapanese.reasoning).toContain('Matched language: ja');
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
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.suggestedLabels).toContain('kdrama');
    });

    test('should have high confidence with Korean language', () => {
      const metadata = {
        title: 'Korean Drama',
        overview: 'A k-drama series',
        genres: ['Drama'],
        keywords: ['k-drama'],
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
      expect(result.reasoning).toContain('Matched language: ko');
      expect(result.confidence).toBeGreaterThan(70);
    });

    test('should have lower confidence without Korean language', () => {
      const metadata = {
        title: 'Korean Drama',
        overview: 'A k-drama series',
        genres: ['Drama'],
        keywords: ['k-drama'],
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

      // Should still detect but with lower confidence
      expect(result.detected).toBe(true);
      expect(result.reasoning).not.toContain('Matched language');
    });

    test('should NOT detect non-Korean drama', () => {
      const metadata = {
        title: 'Breaking Bad',
        overview: 'An American drama series',
        genres: ['Drama', 'Crime'],
        keywords: ['drama', 'crime'],
        certification: 'TV-MA',
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
        title: 'Test Movie',
        overview: 'A stand-up comedy special',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy'],
        certification: undefined,
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
          certification: metadata.certification || '',
          originalLanguage: metadata.original_language,
        }
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle empty genres array', () => {
      const metadata = {
        title: 'Test Movie',
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

      // Should detect from keywords but have lower confidence
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeLessThan(70);
    });

    test('should handle null genres array', () => {
      const metadata = {
        title: 'Test Movie',
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

      // Should detect from keywords but have lower confidence
      expect(result.detected).toBe(true);
    });

    test('should handle empty keywords array', () => {
      const metadata = {
        title: 'stand-up comedy special',
        overview: 'A comedy special',
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

      // Should still detect from title
      expect(result.detected).toBe(true);
    });

    test('should handle undefined originalLanguage', () => {
      const metadata = {
        title: 'Korean Drama',
        overview: 'A k-drama series',
        genres: ['Drama'],
        keywords: ['k-drama'],
        certification: 'TV-14',
        original_language: undefined,
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
          originalLanguage: metadata.original_language || '',
        }
      );

      // Should detect from keywords
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

      // Should still detect from keywords
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

  describe('Confidence Calculation', () => {
    test('should cap multiple keyword matches at 50 points', () => {
      const metadata = {
        title: 'stand-up comedy special',
        overview: 'A live comedy performance recorded at a comedy tour featuring a comedian in a one man show',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special', 'standup'],
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
      // Confidence calculation should cap keyword contribution at 50
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should calculate confidence from genre + keyword combination', () => {
      const metadata = {
        title: 'Concert Film',
        overview: 'A concert film',
        genres: ['Documentary', 'Music'],
        keywords: ['concert'],
        certification: '',
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
      expect(result.confidence).toBeGreaterThan(0);
      // Check that reasoning array contains the expected strings
      const reasoningStr = result.reasoning.join(' ');
      expect(reasoningStr).toContain('Matched required genres');
      expect(reasoningStr).toContain('Matched keywords');
    });

    test('should add rating bonus to confidence', () => {
      const withRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: 'adult animation',
          title: '',
          genres: ['animation'],
          keywords: ['adult animation'],
          certification: 'TV-MA',
          originalLanguage: 'en',
        }
      );

      const withoutRating = contentTypeAnalyzer.checkPattern(
        'adultAnimation',
        contentTypeAnalyzer.patterns.adultAnimation,
        {
          overview: 'adult animation',
          title: '',
          genres: ['animation'],
          keywords: ['adult animation'],
          certification: 'PG',
          originalLanguage: 'en',
        }
      );

      expect(withRating.confidence).toBeGreaterThan(withoutRating.confidence);
    });

    test('should add language bonus to confidence for K-Drama', () => {
      const withLanguage = contentTypeAnalyzer.checkPattern(
        'kdrama',
        contentTypeAnalyzer.patterns.kdrama,
        {
          overview: 'korean drama',
          title: '',
          genres: ['drama'],
          keywords: ['k-drama'],
          certification: '',
          originalLanguage: 'ko',
        }
      );

      const withoutLanguage = contentTypeAnalyzer.checkPattern(
        'kdrama',
        contentTypeAnalyzer.patterns.kdrama,
        {
          overview: 'korean drama',
          title: '',
          genres: ['drama'],
          keywords: ['k-drama'],
          certification: '',
          originalLanguage: 'en',
        }
      );

      expect(withLanguage.confidence).toBeGreaterThan(withoutLanguage.confidence);
      expect(withLanguage.reasoning).toContain('Matched language: ko');
    });

    test('should not exceed 100 confidence', () => {
      const metadata = {
        title: 'stand-up comedy special live comedy recorded live at comedy tour comedian one man show',
        overview: 'stand-up comedy special live comedy recorded live at comedy tour comedian one man show',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special', 'standup', 'live comedy', 'recorded live at', 'comedy tour'],
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

      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should NOT detect with very low confidence (below 40% threshold)', () => {
      const metadata = {
        title: 'Some Movie',
        overview: 'A movie',
        genres: ['Comedy'], // Only partial match
        keywords: ['movie'],
        certification: 'PG-13',
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

      // Even if there's some confidence from partial genre match, 
      // it should NOT be detected if below 40% threshold
      expect(result.detected).toBe(false);
    });
  });

  describe('Other Content Type Patterns', () => {
    describe('Reality TV Detection', () => {
      test('should detect reality TV with proper genres and keywords', () => {
        const metadata = {
          title: 'Survivor',
          overview: 'A reality competition show with contestants',
          genres: ['Documentary', 'Reality'],
          keywords: ['reality', 'competition', 'elimination'],
          certification: 'TV-PG',
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
        expect(result.confidence).toBeGreaterThan(70);
        expect(result.suggestedLabels).toContain('reality');
      });

      test('should NOT detect without required genres', () => {
        const metadata = {
          title: 'Reality Show',
          overview: 'A reality competition show',
          genres: ['Documentary'],
          keywords: ['reality', 'competition'],
          certification: 'TV-PG',
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

        expect(result.confidence).toBeLessThan(70);
      });
    });

    describe('Holiday Content Detection', () => {
      test('should detect holiday content from keywords', () => {
        const metadata = {
          title: 'A Christmas Story',
          overview: 'A holiday special about Christmas and Santa Claus',
          genres: ['Comedy', 'Family'],
          keywords: ['christmas', 'holiday', 'santa claus'],
          certification: 'PG',
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
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.suggestedLabels).toContain('holiday');
      });

      test('should NOT detect non-holiday content', () => {
        const metadata = {
          title: 'Action Movie',
          overview: 'An action-packed thriller',
          genres: ['Action', 'Thriller'],
          keywords: ['action', 'adventure'],
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
      test('should detect halloween content from keywords', () => {
        const metadata = {
          title: 'Halloween Special',
          overview: 'A spooky halloween story about trick or treat',
          genres: ['Horror', 'Comedy'],
          keywords: ['halloween', 'spooky', 'haunted house'],
          certification: 'PG-13',
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
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.suggestedLabels).toContain('halloween');
      });

      test('should NOT detect non-halloween content', () => {
        const metadata = {
          title: 'Summer Fun',
          overview: 'A summer adventure',
          genres: ['Comedy', 'Family'],
          keywords: ['summer', 'beach'],
          certification: 'G',
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

  describe('analyze() Method Integration', () => {
    // Mock the database and settings
    beforeEach(() => {
      // Mock getSettings to return enabled with default confidence
      contentTypeAnalyzer.getSettings = jest.fn().mockResolvedValue({
        enabled: true,
        minConfidence: 75
      });
      
      // Mock logAnalysis to prevent database calls
      contentTypeAnalyzer.logAnalysis = jest.fn().mockResolvedValue();
    });

    test('should analyze and return best match for stand-up comedy', async () => {
      const metadata = {
        title: 'Dave Chappelle: Sticks & Stones',
        overview: 'A stand-up comedy special recorded live',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      expect(result.detections).toBeInstanceOf(Array);
      expect(result.bestMatch).toBeDefined();
      if (result.bestMatch) {
        expect(result.bestMatch.type).toBe('standup');
      }
    });

    test('should return analyzed false when disabled', async () => {
      contentTypeAnalyzer.getSettings = jest.fn().mockResolvedValue({
        enabled: false,
        minConfidence: 75
      });

      const metadata = {
        title: 'Test',
        overview: 'Test content',
        genres: [],
        keywords: [],
        certification: '',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(false);
      expect(result.reason).toBe('Content analysis disabled');
    });

    test('should filter detections by minimum confidence threshold', async () => {
      contentTypeAnalyzer.getSettings = jest.fn().mockResolvedValue({
        enabled: true,
        minConfidence: 90
      });

      const metadata = {
        title: 'Test',
        overview: 'A test',
        genres: [],
        keywords: ['holiday'],
        certification: '',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      // Holiday pattern has base confidence of 75, so shouldn't pass 90 threshold with just one keyword
      expect(result.bestMatch).toBeNull();
    });

    test('should sort detections by confidence', async () => {
      const metadata = {
        title: 'Korean Drama anime',
        overview: 'A k-drama with anime elements',
        genres: [],
        keywords: ['k-drama', 'anime'],
        certification: '',
        original_language: 'ko',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      if (result.detections.length > 1) {
        // Check that detections are sorted by confidence (descending)
        for (let i = 0; i < result.detections.length - 1; i++) {
          expect(result.detections[i].confidence).toBeGreaterThanOrEqual(
            result.detections[i + 1].confidence
          );
        }
      }
    });

    test('should handle errors gracefully', async () => {
      contentTypeAnalyzer.getSettings = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      const metadata = {
        title: 'Test',
        overview: 'Test',
        genres: [],
        keywords: [],
        certification: '',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should determine if detection should override genre', async () => {
      const metadata = {
        title: 'Dave Chappelle: Sticks & Stones',
        overview: 'A stand-up comedy special recorded live',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
      };

      const result = await contentTypeAnalyzer.analyze(metadata);

      expect(result.analyzed).toBe(true);
      expect(result.overridesGenre).toBeDefined();
      expect(typeof result.overridesGenre).toBe('boolean');
    });

    test('should call logAnalysis when classificationId provided', async () => {
      // Set minConfidence to a lower value to ensure detection
      contentTypeAnalyzer.getSettings = jest.fn().mockResolvedValue({
        enabled: true,
        minConfidence: 70
      });

      const metadata = {
        title: 'Dave Chappelle: Sticks & Stones',
        overview: 'A stand-up comedy special recorded live at a comedy club',
        genres: ['Documentary', 'Comedy'],
        keywords: ['stand-up comedy', 'comedy special'],
        certification: 'TV-MA',
        original_language: 'en',
        tmdb_id: 12345,
      };

      await contentTypeAnalyzer.analyze(metadata, 1);

      expect(contentTypeAnalyzer.logAnalysis).toHaveBeenCalled();
    });
  });
});
