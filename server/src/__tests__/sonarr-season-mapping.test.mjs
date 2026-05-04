/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

import { jest } from '@jest/globals';

const mockAxios = {
    get: jest.fn(),
    post: jest.fn()
};
jest.unstable_mockModule('axios', () => ({ default: mockAxios }));

const { default: sonarrService } = await import('../services/sonarr.mjs');
const { parsePayload, sanitizePayload } = await import('../services/webhook.mjs');

describe('Sonarr Season Mapping Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.post.mockReset();
        mockAxios.get.mockReset();

        mockAxios.post.mockResolvedValue({
            data: {
                id: 1,
                title: 'Test Series',
                seasons: []
            }
        });
        
        mockAxios.get.mockResolvedValue({
            data: {
                version: '3.0.0'
            }
        });
    });

    describe('Sonarr API integration', () => {
        it('should successfully add series to Sonarr with seasons', async () => {
            const seriesData = {
                tvdbId: 12345,
                title: 'Test Series',
                seasons: [
                    { seasonNumber: 1, monitored: true },
                    { seasonNumber: 2, monitored: true }
                ],
                monitored: true
            };
            
            mockAxios.post.mockResolvedValueOnce({
                data: {
                    ...seriesData,
                    id: 1
                }
            });
            
            const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
            
            expect(result.seasons).toBeDefined();
            expect(result.seasons.length).toBe(2);
            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://localhost:8989/api/v3/series',
                seriesData,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Api-Key': 'test-key'
                    })
                })
            );
        });
        
        it('should pass through season 0 if included in request', async () => {
            const seriesDataWithSpecials = {
                tvdbId: 12345,
                title: 'Test Series',
                seasons: [
                    { seasonNumber: 0, monitored: true },
                    { seasonNumber: 1, monitored: true },
                    { seasonNumber: 2, monitored: true }
                ],
                monitored: true
            };
            
            mockAxios.post.mockResolvedValueOnce({
                data: {
                    ...seriesDataWithSpecials,
                    id: 1
                }
            });
            
            const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesDataWithSpecials);
            
            expect(result.seasons).toBeDefined();
            expect(result.seasons.some(s => s.seasonNumber === 0)).toBe(true);
            expect(result.seasons.length).toBe(3);
        });
        
        it('should handle empty seasons array', async () => {
            const seriesData = {
                tvdbId: 12345,
                title: 'Test Series',
                seasons: [],
                monitored: true
            };
            
            mockAxios.post.mockResolvedValueOnce({
                data: {
                    ...seriesData,
                    id: 1
                }
            });
            
            const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
            
            expect(result.seasons).toBeDefined();
            expect(result.seasons).toEqual([]);
        });
    });
    
    describe('Overseerr webhook payloads', () => {
        it('should parse Overseerr payload with legacy season format', () => {
            const overseerrPayload = {
                subject: 'Breaking Bad',
                message: 'New request',
                media: {
                    tvdbId: 81189,
                    seasons: '1,2,3',
                    extra: [{
                        name: 'Requested Seasons',
                        value: '1, 2, 3'
                    }]
                },
                request: {
                    requestedBy_username: 'user123',
                    seasons: [1, 2, 3]
                }
            };
            
            const parsed = parsePayload(overseerrPayload);
            
            expect(parsed).toBeDefined();
            expect(parsed.tvdb_id).toBe(81189);
            expect(parsed.title).toBe('Breaking Bad');
            expect(JSON.parse(parsed.requested_seasons)).toEqual([1, 2, 3]);
        });
        
        it('should parse Overseerr payload with array season format', () => {
            const overseerrPayload = {
                subject: 'Breaking Bad',
                media: {
                    tvdbId: 81189,
                    title: 'Breaking Bad'
                },
                request: {
                    seasons: [1, 2, 3],
                    requestedBy_username: 'user123'
                }
            };
            
            const parsed = parsePayload(overseerrPayload);
            
            expect(parsed).toBeDefined();
            expect(parsed.tvdb_id).toBe(81189);
            expect(parsed.title).toBe('Breaking Bad');
            expect(JSON.parse(parsed.requested_seasons)).toEqual([1, 2, 3]);
        });
        
        it('should sanitize payload and exclude specials when includeSpecials is false', () => {
            const payload = {
                request: {
                    seasons: [
                        { seasonNumber: 0 },
                        { seasonNumber: 1 },
                        { seasonNumber: 2 }
                    ]
                }
            };
            
            const { payload: sanitized, specialsExcluded } = sanitizePayload(payload, { includeSpecials: false });
            
            expect(sanitized.request.seasons).toHaveLength(2);
            expect(sanitized.request.seasons.some(s => s.seasonNumber === 0)).toBe(false);
            expect(specialsExcluded).toBe(1);
        });
        
        it('should not exclude specials when includeSpecials is true', () => {
            const payload = {
                request: {
                    seasons: [
                        { seasonNumber: 0 },
                        { seasonNumber: 1 },
                        { seasonNumber: 2 }
                    ]
                }
            };
            
            const { payload: sanitized, specialsExcluded } = sanitizePayload(payload, { includeSpecials: true });
            
            expect(sanitized.request.seasons).toHaveLength(3);
            expect(sanitized.request.seasons.some(s => s.seasonNumber === 0)).toBe(true);
            expect(specialsExcluded).toBe(0);
        });
        
        it('should handle extra array with season 0 when sanitizing', () => {
            const payload = {
                extra: [
                    { seasonNumber: 0, name: 'Specials' },
                    { seasonNumber: 1, name: 'Season 1' }
                ]
            };
            
            const { payload: sanitized, specialsExcluded } = sanitizePayload(payload, { includeSpecials: false });
            
            expect(sanitized.extra).toHaveLength(1);
            expect(sanitized.extra[0].seasonNumber).toBe(1);
            expect(specialsExcluded).toBe(1);
        });
    });
    
    describe('Sonarr API request validation', () => {
        it('should send correct headers and URL to Sonarr API', async () => {
            const seriesData = {
                tvdbId: 12345,
                title: 'Test Series',
                seasons: [
                    { seasonNumber: 1, monitored: true }
                ],
                monitored: true
            };
            
            await sonarrService.addSeries('http://localhost:8989', 'test-api-key', seriesData);
            
            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://localhost:8989/api/v3/series',
                seriesData,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Api-Key': 'test-api-key',
                        'Content-Type': 'application/json'
                    })
                })
            );
        });
    });
});
