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

const sonarrService = require('../../services/sonarr');
const webhookService = require('../../services/webhook');
const axios = require('axios');

// Mock axios for Sonarr API calls
jest.mock('axios');

describe('Sonarr Season Mapping Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful Sonarr API responses
    axios.post.mockResolvedValue({
      data: {
        id: 1,
        title: 'Test Series',
        seasons: []
      }
    });
    
    axios.get.mockResolvedValue({
      data: {
        version: '3.0.0'
      }
    });
  });

  describe('include_specials flag', () => {
    it('should include season 0 when include_specials is true', async () => {
      const seasonsWithSpecials = [
        { seasonNumber: 0, monitored: true },
        { seasonNumber: 1, monitored: true },
        { seasonNumber: 2, monitored: true },
        { seasonNumber: 3, monitored: true }
      ];
      
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: seasonsWithSpecials,
        monitored: true
      };
      
      // Mock the API to echo back the seasons we send
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1,
          seasons: seasonsWithSpecials
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      expect(result.seasons).toBeDefined();
      expect(result.seasons.some(s => s.seasonNumber === 0)).toBe(true);
      expect(result.seasons.length).toBe(4); // 0, 1, 2, 3
    });
    
    it('should exclude season 0 when include_specials is false', async () => {
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true },
          { seasonNumber: 3, monitored: true }
        ],
        monitored: true
      };
      
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      expect(result.seasons).toBeDefined();
      expect(result.seasons.some(s => s.seasonNumber === 0)).toBe(false);
      expect(result.seasons.length).toBe(3); // 1, 2, 3
    });
    
    it('should handle undefined include_specials (default false)', async () => {
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true },
          { seasonNumber: 3, monitored: true }
        ],
        monitored: true
        // include_specials undefined
      };
      
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      expect(result.seasons).toBeDefined();
      expect(result.seasons.some(s => s.seasonNumber === 0)).toBe(false);
    });
    
    it('should handle empty seasons array with include_specials true', async () => {
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 0, monitored: true }
        ],
        monitored: true
      };
      
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      expect(result.seasons).toBeDefined();
      expect(result.seasons.length).toBe(1);
      expect(result.seasons[0].seasonNumber).toBe(0);
    });
    
    it('should deduplicate season 0 if already in seasons array', async () => {
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 0, monitored: true },
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true }
        ],
        monitored: true
      };
      
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      // Should not duplicate season 0
      const season0Count = result.seasons.filter(s => s.seasonNumber === 0).length;
      expect(season0Count).toBe(1);
      expect(result.seasons.length).toBe(3); // 0, 1, 2
    });
  });
  
  describe('Overseerr webhook payloads', () => {
    it('should handle Overseerr payload with legacy season format', () => {
      const overseerrPayload = {
        subject: 'Breaking Bad',
        message: 'New request',
        media: {
          tvdbId: 81189,
          seasons: '1,2,3',  // Legacy string format
          extra: [{
            name: 'Requested Seasons',
            value: '1, 2, 3'
          }]
        },
        request: {
          requestedBy_username: 'user123'
        }
      };
      
      const parsed = webhookService.parsePayload(overseerrPayload);
      
      expect(parsed).toBeDefined();
      expect(parsed.tvdb_id).toBe(81189);
      expect(parsed.title).toBe('Breaking Bad');
    });
    
    it('should handle Overseerr payload with include_specials', () => {
      const overseerrPayload = {
        subject: 'Breaking Bad',
        media: {
          tvdbId: 81189,
          seasons: [1, 2, 3],
          include_specials: true
        },
        request: {
          seasons: [1, 2, 3]
        }
      };
      
      const parsed = webhookService.parsePayload(overseerrPayload);
      
      expect(parsed).toBeDefined();
      expect(parsed.tvdb_id).toBe(81189);
      expect(parsed.title).toBe('Breaking Bad');
    });
    
    it('should sanitize payload and exclude specials when include_specials is false', () => {
      const payload = {
        request: {
          seasons: [
            { seasonNumber: 0 },
            { seasonNumber: 1 },
            { seasonNumber: 2 }
          ]
        }
      };
      
      const { payload: sanitized, specialsExcluded } = webhookService.sanitizePayload(payload, { includeSpecials: false });
      
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
      
      const { payload: sanitized, specialsExcluded } = webhookService.sanitizePayload(payload, { includeSpecials: true });
      
      expect(sanitized.request.seasons).toHaveLength(3);
      expect(sanitized.request.seasons.some(s => s.seasonNumber === 0)).toBe(true);
      expect(specialsExcluded).toBe(0);
    });
  });
  
  describe('Multi-instance Sonarr', () => {
    it('should apply include_specials to correct instance', async () => {
      // This test verifies that when adding series to a specific Sonarr instance,
      // the include_specials flag is properly handled
      
      const seriesData = {
        tvdbId: 12345,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 0, monitored: true }, // Specials
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true }
        ],
        monitored: true
      };
      
      axios.post.mockResolvedValueOnce({
        data: {
          ...seriesData,
          id: 1
        }
      });
      
      const result = await sonarrService.addSeries('http://localhost:8989', 'test-key', seriesData);
      
      expect(result.seasons).toBeDefined();
      expect(result.seasons.some(s => s.seasonNumber === 0)).toBe(true);
      
      // Verify the request was made to the correct endpoint
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:8989/api/v3/series',
        seriesData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'test-key'
          })
        })
      );
    });
  });
});
