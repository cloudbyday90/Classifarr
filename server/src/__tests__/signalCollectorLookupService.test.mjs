import { jest } from '@jest/globals';
import { SignalCollectorLookupService } from '../services/signalCollectorLookupService.mjs';

describe('SignalCollectorLookupService', () => {
    let db;
    let tmdbService;
    let logger;
    let service;

    beforeEach(() => {
        db = { query: jest.fn() };
        tmdbService = { getMovieDetails: jest.fn() };
        logger = {
            debug: jest.fn(),
            warn: jest.fn(),
        };
        service = new SignalCollectorLookupService({ db, tmdbService, logger });
    });

    describe('checkFranchiseMembership', () => {
        it('returns null for non-movie media types', async () => {
            await expect(service.checkFranchiseMembership(123, 'tv')).resolves.toBeNull();
            expect(tmdbService.getMovieDetails).not.toHaveBeenCalled();
        });

        it('returns collection details for movie franchises', async () => {
            tmdbService.getMovieDetails.mockResolvedValue({
                belongs_to_collection: {
                    id: 42,
                    name: 'Example Collection',
                    poster_path: '/poster.jpg',
                    backdrop_path: '/backdrop.jpg',
                },
            });

            await expect(service.checkFranchiseMembership(123, 'movie')).resolves.toEqual({
                collectionId: 42,
                collectionName: 'Example Collection',
                posterPath: '/poster.jpg',
                backdropPath: '/backdrop.jpg',
            });
        });

        it('swallows tmdb errors and logs a warning', async () => {
            tmdbService.getMovieDetails.mockRejectedValue(new Error('tmdb offline'));

            await expect(service.checkFranchiseMembership(123, 'movie')).resolves.toBeNull();
            expect(logger.warn).toHaveBeenCalledWith('Failed to check franchise membership', expect.objectContaining({
                tmdbId: 123,
                error: 'tmdb offline',
            }));
        });
    });

    describe('findRelatedClassifiedItems', () => {
        it('returns rows for a collection query', async () => {
            const rows = [{ library_id: 1, title: 'Movie' }];
            db.query.mockResolvedValue({ rows });

            await expect(service.findRelatedClassifiedItems(7)).resolves.toEqual(rows);
            expect(db.query).toHaveBeenCalled();
        });

        it('returns [] on database error', async () => {
            db.query.mockRejectedValue(new Error('db offline'));

            await expect(service.findRelatedClassifiedItems(7)).resolves.toEqual([]);
            expect(logger.debug).toHaveBeenCalledWith('Could not query related items', { error: 'db offline' });
        });
    });

    describe('findExactMatchSignal', () => {
        it('returns null when no evidence lookup exists', async () => {
            await expect(service.findExactMatchSignal({}, 1, 'movie')).resolves.toBeNull();
        });

        it('normalizes exact matches to signal collector shape', async () => {
            const classificationEvidenceService = {
                findExactMatch: jest.fn().mockResolvedValue({ libraryId: 9, confidence: 96 }),
            };

            await expect(service.findExactMatchSignal(classificationEvidenceService, 123, 'movie')).resolves.toEqual({
                library_id: 9,
                confidence: 96,
            });
            expect(classificationEvidenceService.findExactMatch).toHaveBeenCalledWith({ tmdbId: 123, mediaType: 'movie' });
        });
    });
});
