const webhookService = require('../services/webhook');

describe('WebhookService - parsePayload', () => {
  describe('Movie Request Parsing', () => {
    test('should correctly extract movie information from Overseerr webhook', () => {
      const payload = {
        notification_type: 'MEDIA_PENDING',
        event: 'media.pending',
        subject: 'New Movie Request - The Matrix',
        media: {
          media_type: 'movie',
          tmdbId: 603,
          title: 'The Matrix',
          releaseDate: '1999-03-31',
          posterPath: '/path/to/poster.jpg'
        },
        request: {
          id: 123,
          is4k: false,
          requestedBy: {
            username: 'testuser',
            email: 'test@example.com',
            avatar: '/avatar.jpg',
            displayName: 'Test User'
          },
          createdAt: '2023-12-01T10:00:00Z'
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.notification_type).toBe('MEDIA_PENDING');
      expect(result.event_name).toBe('media.pending');
      expect(result.media_type).toBe('movie');
      expect(result.tmdb_id).toBe(603);
      expect(result.title).toBe('New Movie Request - The Matrix');
      expect(result.year).toBe(1999);
      expect(result.poster_path).toBe('/path/to/poster.jpg');
      expect(result.is_4k).toBe(false);
      expect(result.request_id).toBe(123);
      expect(result.requested_by_username).toBe('testuser');
      expect(result.requested_by_email).toBe('test@example.com');
      expect(result.requested_by_avatar).toBe('/avatar.jpg');
    });

    test('should handle movie with alternative field names', () => {
      const payload = {
        event: 'media.approved',
        subject: 'Movie Approved',
        media: {
          mediaType: 'movie',
          tmdb_id: 550,
          name: 'Fight Club',
          poster_path: '/poster.jpg'
        },
        request_id: 456,
        is_4k: true,
        requestedBy: {
          username: 'admin'
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.media_type).toBe('movie');
      expect(result.tmdb_id).toBe(550);
      expect(result.request_id).toBe(456);
      expect(result.is_4k).toBe(true);
      expect(result.requested_by_username).toBe('admin');
    });

    test('should infer movie type from subject when media_type is missing', () => {
      const payload = {
        subject: 'New Movie Request - Inception',
        media: {
          tmdbId: 27205
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.media_type).toBe('movie');
      expect(result.title).toBe('New Movie Request - Inception');
    });
  });

  describe('TV Show Request Parsing', () => {
    test('should correctly extract TV show information from Overseerr webhook', () => {
      const payload = {
        notification_type: 'MEDIA_PENDING',
        event: 'media.pending',
        subject: 'New TV Show Request - Breaking Bad',
        media: {
          media_type: 'tv',
          tmdbId: 1396,
          tvdbId: 81189,
          title: 'Breaking Bad',
          releaseDate: '2008-01-20',
          posterPath: '/tv/poster.jpg'
        },
        request: {
          id: 789,
          is4k: false,
          seasons: [1, 2, 3, 4, 5],
          requestedBy: {
            username: 'tvfan',
            email: 'tvfan@example.com'
          },
          createdAt: '2023-12-01T15:30:00Z'
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.media_type).toBe('tv');
      expect(result.tmdb_id).toBe(1396);
      expect(result.tvdb_id).toBe(81189);
      expect(result.request_id).toBe(789);
      expect(result.requested_seasons).toBe(JSON.stringify([1, 2, 3, 4, 5]));
      expect(result.year).toBe(2008);
    });

    test('should infer tv type from subject when media_type is missing', () => {
      const payload = {
        subject: 'New Series Request - The Office',
        media: {
          tmdbId: 2316
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.media_type).toBe('tv');
    });
  });

  describe('Missing Fields Handling', () => {
    test('should handle payload with minimal information', () => {
      const payload = {
        subject: 'New Movie Request'
      };

      const result = webhookService.parsePayload(payload);

      expect(result.title).toBe('New Movie Request');
      expect(result.media_type).toBe('movie');
      expect(result.tmdb_id).toBeUndefined();
      expect(result.request_id).toBeUndefined();
      expect(result.year).toBeNull();
      expect(result.is_4k).toBe(false);
    });

    test('should handle missing media object', () => {
      const payload = {
        notification_type: 'MEDIA_PENDING',
        subject: 'Test Request'
      };

      const result = webhookService.parsePayload(payload);

      expect(result.notification_type).toBe('MEDIA_PENDING');
      expect(result.title).toBe('Test Request');
      expect(result.tmdb_id).toBeUndefined();
    });

    test('should handle missing request object', () => {
      const payload = {
        subject: 'Test',
        media: {
          tmdbId: 100
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.tmdb_id).toBe(100);
      expect(result.request_id).toBeUndefined();
      expect(result.requested_by_username).toBeUndefined();
    });

    test('should handle missing requestedBy object', () => {
      const payload = {
        subject: 'Test',
        request: {
          id: 999
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.request_id).toBe(999);
      expect(result.requested_by_username).toBeUndefined();
      expect(result.requested_by_email).toBeUndefined();
    });

    test('should handle null values gracefully', () => {
      const payload = {
        subject: null,
        media: {
          tmdbId: 123,
          title: null,
          releaseDate: null
        },
        request: {
          id: null,
          requestedBy: null
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.title).toBe('');
      expect(result.year).toBeNull();
      expect(result.request_id).toBeNull();
    });

    test('should handle empty payload', () => {
      const payload = {};

      const result = webhookService.parsePayload(payload);

      expect(result.notification_type).toBeUndefined();
      expect(result.title).toBe('');
      expect(result.media_type).toBe('movie');
      expect(result.is_4k).toBe(false);
    });

    test('should default is_4k to false when not provided', () => {
      const payload = {
        media: { tmdbId: 100 },
        request: {}
      };

      const result = webhookService.parsePayload(payload);

      expect(result.is_4k).toBe(false);
    });

    test('should handle missing releaseDate', () => {
      const payload = {
        media: {
          tmdbId: 100
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.year).toBeNull();
    });

    test('should extract username from displayName when username is missing', () => {
      const payload = {
        request: {
          requestedBy: {
            displayName: 'Display Name'
          }
        }
      };

      const result = webhookService.parsePayload(payload);

      expect(result.requested_by_username).toBe('Display Name');
    });
  });
});
