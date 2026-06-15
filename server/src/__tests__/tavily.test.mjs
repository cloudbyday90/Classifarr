/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for TavilyService
 */

import { jest } from '@jest/globals';

const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const { tavilyService: service } = await import('../services/tavily.mjs');

describe('TavilyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHttpPost.mockReset();
    });

    describe('constructor', () => {
        it('should have base URL set', () => {
            expect(service.baseUrl).toBe('https://api.tavily.com');
        });
    });

    describe('testConnection', () => {
        it('should return success on valid connection', async () => {
            mockHttpPost.mockResolvedValue({
                data: { results: [] }
            });

            const result = await service.testConnection('valid-api-key');

            expect(result.success).toBe(true);
            expect(result.message).toBe('Connection successful');
        });

        it('should return error on failed connection', async () => {
            mockHttpPost.mockRejectedValue({
                response: { data: { error: 'Invalid API key' } }
            });

            const result = await service.testConnection('invalid-key');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid API key');
        });

        it('should handle network errors', async () => {
            mockHttpPost.mockRejectedValue({
                message: 'Network Error'
            });

            const result = await service.testConnection('test-key');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network Error');
        });
    });

    describe('checkHealth', () => {
        it('should return unhealthy when API key not configured', async () => {
            const result = await service.checkHealth(null);

            expect(result.healthy).toBe(false);
            expect(result.api_reachable).toBe(false);
            expect(result.message).toBe('Tavily API key not configured');
        });

        it('should return healthy on successful check', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            const result = await service.checkHealth('valid-key');

            expect(result.healthy).toBe(true);
            expect(result.ssl_error).toBe(false);
            expect(result.api_reachable).toBe(true);
        });

        it('should detect SSL certificate errors', async () => {
            mockHttpPost.mockRejectedValue({
                code: 'CERT_HAS_EXPIRED',
                message: 'certificate has expired'
            });

            const result = await service.checkHealth('test-key');

            expect(result.healthy).toBe(false);
            expect(result.ssl_error).toBe(true);
            expect(result.api_reachable).toBe(false);
        });

        it('should detect network errors', async () => {
            mockHttpPost.mockRejectedValue({
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            });

            const result = await service.checkHealth('test-key');

            expect(result.healthy).toBe(false);
            expect(result.ssl_error).toBe(false);
            expect(result.api_reachable).toBe(false);
            expect(result.message).toContain('Network error');
        });

        it('should detect DNS errors', async () => {
            mockHttpPost.mockRejectedValue({
                code: 'ENOTFOUND',
                message: 'DNS not found'
            });

            const result = await service.checkHealth('test-key');

            expect(result.healthy).toBe(false);
            expect(result.api_reachable).toBe(false);
        });

        it('should handle API errors with response', async () => {
            mockHttpPost.mockRejectedValue({
                response: { status: 401, data: { error: 'Unauthorized' } }
            });

            const result = await service.checkHealth('invalid-key');

            expect(result.healthy).toBe(false);
            expect(result.api_reachable).toBe(true);
            expect(result.message).toBe('Unauthorized');
        });

        it('should handle certificate message in error', async () => {
            mockHttpPost.mockRejectedValue({
                code: 'ERR_TLS',
                message: 'certificate verify failed'
            });

            const result = await service.checkHealth('test-key');

            expect(result.ssl_error).toBe(true);
        });
    });

    describe('search', () => {
        it('should search with default options', async () => {
            const mockResults = {
                results: [{ url: 'https://imdb.com/title/tt123', content: 'Test' }],
                answer: 'Test answer'
            };
            mockHttpPost.mockResolvedValue({ data: mockResults });

            const result = await service.search('test query', { apiKey: 'test-key' });

            expect(result).toEqual(mockResults);
            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    query: 'test query',
                    search_depth: 'basic',
                    max_results: 5,
                    include_domains: ['imdb.com', 'rottentomatoes.com']
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
            expect(mockHttpPost.mock.calls[0][1]).not.toHaveProperty('api_key');
        });

        it('should throw error when API key missing', async () => {
            await expect(service.search('test')).rejects.toThrow('Tavily API key is required');
        });

        it('should accept custom options', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.search('test', {
                apiKey: 'test-key',
                searchDepth: 'advanced',
                maxResults: 10,
                includeDomains: ['example.com'],
                excludeDomains: ['spam.com']
            });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    search_depth: 'advanced',
                    max_results: 10,
                    include_domains: ['example.com'],
                    exclude_domains: ['spam.com']
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });

        it('should clamp max results before sending provider request', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.search('test', {
                apiKey: 'test-key',
                maxResults: 100
            });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    max_results: 20
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });

        it('should handle API errors', async () => {
            mockHttpPost.mockRejectedValue({
                response: { data: { error: 'Rate limit exceeded' } }
            });

            await expect(service.search('test', { apiKey: 'key' }))
                .rejects.toThrow('Tavily search failed: Rate limit exceeded');
        });

        it('should handle unknown errors', async () => {
            mockHttpPost.mockRejectedValue({});

            await expect(service.search('test', { apiKey: 'key' }))
                .rejects.toThrow('Tavily search failed: Unknown error occurred');
        });
    });

    describe('searchIMDB', () => {
        it('should search IMDB with correct query', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.searchIMDB('The Matrix', 1999, 'movie', { apiKey: 'test-key' });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    query: 'The Matrix 1999 movie site:imdb.com',
                    include_domains: ['imdb.com'],
                    max_results: 3
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });
    });

    describe('getContentAdvisory', () => {
        it('should search for content advisory', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.getContentAdvisory('Squid Game', 2021, { apiKey: 'test-key' });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    query: 'Squid Game 2021 IMDB parents guide content advisory',
                    include_domains: ['imdb.com'],
                    max_results: 2
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });
    });

    describe('searchAnimeInfo', () => {
        it('should search anime databases', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.searchAnimeInfo('Naruto', { apiKey: 'test-key' });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    query: 'Naruto anime MyAnimeList',
                    include_domains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
                    max_results: 3
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });
    });

    describe('getReviewInfo', () => {
        it('should search review sites', async () => {
            mockHttpPost.mockResolvedValue({ data: { results: [] } });

            await service.getReviewInfo('The Dark Knight', 2008, 'movie', { apiKey: 'test-key' });

            expect(mockHttpPost).toHaveBeenCalledWith(
                'https://api.tavily.com/search',
                expect.objectContaining({
                    query: 'The Dark Knight 2008 movie reviews ratings',
                    include_domains: ['rottentomatoes.com', 'metacritic.com', 'letterboxd.com'],
                    max_results: 3
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });
    });

    describe('formatForAI', () => {
        it('should format results for AI consumption', () => {
            const results = {
                results: [
                    { url: 'https://imdb.com/title/tt123', title: 'Test Movie', content: 'Great movie' }
                ],
                answer: 'This is a great movie'
            };

            const formatted = service.formatForAI(results);

            expect(formatted).toContain('Web Search Results (tavily):');
            expect(formatted).toContain('Source: https://imdb.com/title/tt123');
            expect(formatted).toContain('Title: Test Movie');
            expect(formatted).toContain('Content: Great movie');
            expect(formatted).toContain('Summary: This is a great movie');
        });

        it('should handle empty results', () => {
            const formatted = service.formatForAI(null);

            expect(formatted).toBe('No additional information found.');
        });

        it('should handle results without results array', () => {
            const formatted = service.formatForAI({});

            expect(formatted).toBe('No additional information found.');
        });

        it('should handle results without answer', () => {
            const results = {
                results: [
                    { url: 'https://example.com', title: 'Test', content: 'Content' }
                ]
            };

            const formatted = service.formatForAI(results);

            expect(formatted).not.toContain('Summary:');
        });

        it('should format multiple results', () => {
            const results = {
                results: [
                    { url: 'https://site1.com', title: 'Result 1', content: 'Content 1' },
                    { url: 'https://site2.com', title: 'Result 2', content: 'Content 2' }
                ]
            };

            const formatted = service.formatForAI(results);

            expect(formatted).toContain('site1.com');
            expect(formatted).toContain('site2.com');
            expect(formatted).toContain('Result 1');
            expect(formatted).toContain('Result 2');
        });
    });
});
