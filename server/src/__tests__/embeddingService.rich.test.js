const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');

jest.mock('../services/embeddingRouter');
jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('EmbeddingService - Rich Embeddings', () => {
    let consoleErrorSpy;

    beforeAll(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('EMBEDDING_FORMAT_VERSION', () => {
        it('should be set to version 2', () => {
            expect(embeddingService.EMBEDDING_FORMAT_VERSION).toBe(2);
        });
    });

    describe('safeGet', () => {
        it('should safely access nested properties', () => {
            const obj = {
                level1: {
                    level2: {
                        value: 'test'
                    }
                }
            };

            expect(embeddingService.safeGet(obj, 'level1.level2.value')).toBe('test');
            expect(embeddingService.safeGet(obj, 'level1.level2')).toEqual({ value: 'test' });
        });

        it('should return default for missing properties', () => {
            const obj = { a: { b: 1 } };

            expect(embeddingService.safeGet(obj, 'a.c', 'default')).toBe('default');
            expect(embeddingService.safeGet(obj, 'x.y.z', null)).toBeNull();
        });

        it('should handle null/undefined objects', () => {
            expect(embeddingService.safeGet(null, 'any.path', 'default')).toBe('default');
            expect(embeddingService.safeGet(undefined, 'any.path', 'default')).toBe('default');
        });
    });

    describe('extractNames', () => {
        it('should extract names from array of objects', () => {
            const items = [
                { name: 'Item 1', id: 1 },
                { name: 'Item 2', id: 2 },
                { name: 'Item 3', id: 3 }
            ];

            const names = embeddingService.extractNames(items, 3);
            expect(names).toEqual(['Item 1', 'Item 2', 'Item 3']);
        });

        it('should handle array of strings', () => {
            const items = ['String 1', 'String 2', 'String 3'];
            const names = embeddingService.extractNames(items, 2);
            expect(names).toEqual(['String 1', 'String 2']);
        });

        it('should handle mixed string/object arrays', () => {
            const items = [
                'Direct String',
                { name: 'Object Name' },
                { title: 'Object Title' }
            ];

            const names = embeddingService.extractNames(items, 3);
            expect(names).toEqual(['Direct String', 'Object Name', 'Object Title']);
        });

        it('should respect limit parameter', () => {
            const items = [
                { name: '1' },
                { name: '2' },
                { name: '3' },
                { name: '4' },
                { name: '5' }
            ];

            const names = embeddingService.extractNames(items, 3);
            expect(names).toHaveLength(3);
            expect(names).toEqual(['1', '2', '3']);
        });

        it('should filter out null/undefined values', () => {
            const items = [
                { name: 'Valid' },
                { id: 1 }, // No name or title
                null,
                { name: 'Also Valid' }
            ];

            const names = embeddingService.extractNames(items, 5);
            expect(names).toEqual(['Valid', 'Also Valid']);
        });

        it('should return empty array for invalid input', () => {
            expect(embeddingService.extractNames(null, 3)).toEqual([]);
            expect(embeddingService.extractNames([], 3)).toEqual([]);
            expect(embeddingService.extractNames(undefined, 3)).toEqual([]);
        });
    });

    describe('formatForEmbedding - Rich Format v2', () => {
        it('should include studio/production companies (top 3)', () => {
            const metadata = {
                title: 'Test Movie',
                production_companies: [
                    { name: 'Studio A' },
                    { name: 'Studio B' },
                    { name: 'Studio C' },
                    { name: 'Studio D' } // Should be excluded (limit 3)
                ]
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Studio: Studio A, Studio B, Studio C');
            expect(result).not.toContain('Studio D');
        });

        it('should include franchise/collection', () => {
            const metadata = {
                title: 'Movie',
                belongs_to_collection: {
                    name: 'Marvel Cinematic Universe',
                    id: 123
                }
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Franchise: Marvel Cinematic Universe');
        });

        it('should handle string collection format', () => {
            const metadata = {
                title: 'Movie',
                belongs_to_collection: 'Star Wars Collection'
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Franchise: Star Wars Collection');
        });

        it('should include cast (top 3)', () => {
            const metadata = {
                title: 'Movie',
                cast: [
                    { name: 'Actor 1' },
                    { name: 'Actor 2' },
                    { name: 'Actor 3' },
                    { name: 'Actor 4' }
                ]
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Cast: Actor 1, Actor 2, Actor 3');
            expect(result).not.toContain('Actor 4');
        });

        it('should include certification/rating', () => {
            const metadata = {
                title: 'Movie',
                certification: 'PG-13'
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Rating: PG-13');
        });

        it('should handle content_rating as fallback', () => {
            const metadata = {
                title: 'TV Show',
                content_rating: 'TV-MA'
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Rating: TV-MA');
        });

        it('should include vote average formatted as X.X/10', () => {
            const metadata = {
                title: 'Movie',
                vote_average: 8.456
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Score: 8.5/10');
        });

        it('should use pipe separator for v2 format', () => {
            const metadata = {
                title: 'Movie',
                year: 2024,
                media_type: 'movie'
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain(' | ');
            expect(result).toMatch(/Title: Movie \| Year: 2024 \| Type: Movie/);
        });

        it('should handle null/undefined nested objects gracefully', () => {
            const metadata = {
                title: 'Movie',
                production_companies: null,
                belongs_to_collection: null,
                cast: undefined,
                certification: null
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Title: Movie');
            expect(result).not.toContain('Studio:');
            expect(result).not.toContain('Franchise:');
            expect(result).not.toContain('Cast:');
            expect(result).not.toContain('Rating:');
        });

        it('should truncate overview to 300 characters', () => {
            const longOverview = 'A'.repeat(400);
            const metadata = {
                title: 'Movie',
                overview: longOverview
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('Synopsis: ' + 'A'.repeat(300) + '...');
            expect(result.length).toBeLessThan(longOverview.length + 100);
        });

        it('should handle Unicode/non-English content', () => {
            const metadata = {
                title: '映画タイトル',
                production_companies: [
                    { name: 'スタジオ A' }
                ],
                overview: 'これは日本語の概要です。'
            };

            const result = embeddingService.formatForEmbedding(metadata);
            expect(result).toContain('映画タイトル');
            expect(result).toContain('スタジオ A');
            expect(result).toContain('これは日本語の概要です。');
        });

        it('should create complete rich embedding with all fields', () => {
            const metadata = {
                title: 'Avengers: Endgame',
                year: 2019,
                media_type: 'movie',
                genres: [{ name: 'Action' }, { name: 'Adventure' }],
                certification: 'PG-13',
                original_language: 'en',
                production_companies: [
                    { name: 'Marvel Studios' },
                    { name: 'Walt Disney Pictures' }
                ],
                belongs_to_collection: { name: 'The Avengers Collection' },
                cast: [
                    { name: 'Robert Downey Jr.' },
                    { name: 'Chris Evans' },
                    { name: 'Scarlett Johansson' }
                ],
                keywords: [
                    { name: 'superhero' },
                    { name: 'marvel' }
                ],
                vote_average: 8.4,
                library_name: 'Movies',
                overview: 'Epic conclusion to the Infinity Saga.'
            };

            const result = embeddingService.formatForEmbedding(metadata);

            expect(result).toContain('Title: Avengers: Endgame');
            expect(result).toContain('Year: 2019');
            expect(result).toContain('Type: Movie');
            expect(result).toContain('Genres: Action, Adventure');
            expect(result).toContain('Rating: PG-13');
            expect(result).toContain('Language: en');
            expect(result).toContain('Studio: Marvel Studios, Walt Disney Pictures');
            expect(result).toContain('Franchise: The Avengers Collection');
            expect(result).toContain('Cast: Robert Downey Jr., Chris Evans, Scarlett Johansson');
            expect(result).toContain('Keywords: superhero, marvel');
            expect(result).toContain('Score: 8.4/10');
            expect(result).toContain('Classified: Movies');
            expect(result).toContain('Synopsis: Epic conclusion to the Infinity Saga.');
        });
    });

    describe('checkEmbeddingVersionMismatch', () => {
        it('should detect version mismatch', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ embedding_format_version: 1 });

            const mismatch = await embeddingService.checkEmbeddingVersionMismatch();
            expect(mismatch).toBe(true);
        });

        it('should return false when versions match', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ embedding_format_version: 2 });

            const mismatch = await embeddingService.checkEmbeddingVersionMismatch();
            expect(mismatch).toBe(false);
        });

        it('should handle missing config gracefully', async () => {
            embeddingRouter.getConfig.mockResolvedValue(null);

            const mismatch = await embeddingService.checkEmbeddingVersionMismatch();
            expect(mismatch).toBe(true); // Default is 1, current is 2
        });
    });
});
