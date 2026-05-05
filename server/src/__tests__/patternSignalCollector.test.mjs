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

const mockDatabase = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDatabase, default: mockDatabase }));

const mockEmbeddingRouter = { getConfig: jest.fn() };
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

const mockMetadataNormalization = {
    normalizeMetadataList: jest.fn(),
    normalizeMetadataListLower: jest.fn()
};
jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => ({ ...mockMetadataNormalization, default: mockMetadataNormalization }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    })
}));

const db = mockDatabase;
const embeddingRouter = mockEmbeddingRouter;
const { normalizeMetadataList, normalizeMetadataListLower } = mockMetadataNormalization;
let svc;

beforeAll(async () => {
    ({ patternSignalCollector: svc } = await import('../services/patternSignalCollector.mjs'));
});

beforeEach(() => {
    db.query.mockReset();
    embeddingRouter.getConfig.mockReset();
    normalizeMetadataList.mockReset();
    normalizeMetadataListLower.mockReset();
    jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isEnabled
// ---------------------------------------------------------------------------

describe('isEnabled', () => {
    test('returns true when pattern_mining_enabled is true', async () => {
        embeddingRouter.getConfig.mockResolvedValueOnce({ pattern_mining_enabled: true });
        expect(await svc.isEnabled()).toBe(true);
    });

    test('returns false when pattern_mining_enabled is false', async () => {
        embeddingRouter.getConfig.mockResolvedValueOnce({ pattern_mining_enabled: false });
        expect(await svc.isEnabled()).toBe(false);
    });

    test('returns false on error', async () => {
        embeddingRouter.getConfig.mockRejectedValueOnce(new Error('timeout'));
        expect(await svc.isEnabled()).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// collectSignals
// ---------------------------------------------------------------------------

describe('collectSignals', () => {
    test('returns [] when disabled', async () => {
        jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(false);
        const result = await svc.collectSignals({ genres: ['Action'] });
        expect(result).toEqual([]);
    });

    test('returns [] when metadata is null', async () => {
        jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
        const result = await svc.collectSignals(null);
        expect(result).toEqual([]);
    });

    test('collects studio signals when studios present', async () => {
        jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
        normalizeMetadataList.mockReturnValue([]); // keywords → no franchise
        jest.spyOn(svc, 'collectStudioPatterns').mockResolvedValueOnce([
            { type: 'pattern_studio', confidence: 80 }
        ]);
        jest.spyOn(svc, 'collectGenrePatterns').mockResolvedValueOnce([]);
        jest.spyOn(svc, 'collectFranchisePatterns').mockResolvedValueOnce([]);

        const result = await svc.collectSignals({ studios: ['Marvel'], genres: [] });
        expect(result).toEqual([{ type: 'pattern_studio', confidence: 80 }]);
    });

    test('sorts signals by confidence descending', async () => {
        jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
        normalizeMetadataList
            .mockReturnValueOnce([])   // keywords (franchise check)
            .mockReturnValueOnce(['Action', 'Comedy']); // genres (normalized)
        jest.spyOn(svc, 'collectStudioPatterns').mockResolvedValueOnce([]);
        jest.spyOn(svc, 'collectGenrePatterns').mockResolvedValueOnce([
            { type: 'pattern_genre', confidence: 60 },
            { type: 'pattern_genre', confidence: 90 }
        ]);
        jest.spyOn(svc, 'collectCertificationPatterns').mockResolvedValueOnce([
            { type: 'pattern_certification', confidence: 75 }
        ]);

        const result = await svc.collectSignals({
            studios: [],
            genres: ['Action', 'Comedy'],
            certification: 'PG-13'
        });
        expect(result[0].confidence).toBe(90);
        expect(result[1].confidence).toBe(75);
        expect(result[2].confidence).toBe(60);
    });

    test('returns [] and swallows error on unexpected failure', async () => {
        jest.spyOn(svc, 'isEnabled').mockRejectedValueOnce(new Error('boom'));
        const result = await svc.collectSignals({ genres: ['Action'] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// collectStudioPatterns
// ---------------------------------------------------------------------------

describe('collectStudioPatterns', () => {
    test('returns [] for empty studios array', async () => {
        expect(await svc.collectStudioPatterns([], 50)).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('returns matched studio signals', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 10, pattern_value: 'Marvel', confidence: '85', sample_size: 20,
                status: 'approved', library_id: 1, library_name: 'Movies'
            }]
        });
        const result = await svc.collectStudioPatterns(['Marvel', 'Disney'], 50);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('pattern_studio');
        expect(result[0].pattern_value).toBe('Marvel');
        expect(result[0].confidence).toBe(85);
        expect(result[0].library.name).toBe('Movies');
    });

    test('maintains original studio order', async () => {
        db.query.mockResolvedValueOnce({
            rows: [
                { id: 1, pattern_value: 'Pixar', confidence: '70', sample_size: 5, status: 'discovered', library_id: 2, library_name: 'Kids' },
                { id: 2, pattern_value: 'Marvel', confidence: '90', sample_size: 30, status: 'approved', library_id: 1, library_name: 'Movies' }
            ]
        });
        const result = await svc.collectStudioPatterns(['Marvel', 'Pixar'], 50);
        expect(result[0].pattern_value).toBe('Marvel');
        expect(result[1].pattern_value).toBe('Pixar');
    });

    test('swallows DB error and returns []', async () => {
        db.query.mockRejectedValueOnce(new Error('DB down'));
        expect(await svc.collectStudioPatterns(['Marvel'], 50)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// collectFranchisePatterns
// ---------------------------------------------------------------------------

describe('collectFranchisePatterns', () => {
    test('returns [] when no collection and no franchise keywords', async () => {
        normalizeMetadataListLower.mockReturnValueOnce([]);
        const result = await svc.collectFranchisePatterns({ keywords: [] }, 50);
        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('uses collection name as franchise value', async () => {
        normalizeMetadataListLower.mockReturnValueOnce([]);
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 5, pattern_value: 'Marvel Cinematic Universe', confidence: '88',
                sample_size: 50, status: 'approved', library_id: 1, library_name: 'Movies'
            }]
        });

        const result = await svc.collectFranchisePatterns(
            { collection: { name: 'Marvel Cinematic Universe' }, keywords: [] },
            50
        );
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('pattern_franchise');
        expect(result[0].pattern_value).toBe('Marvel Cinematic Universe');
    });

    test('includes franchise-related keywords (universe/series/franchise)', async () => {
        normalizeMetadataListLower.mockReturnValueOnce(['mcu universe', 'action', 'marvel series']);
        db.query.mockResolvedValueOnce({ rows: [] });

        await svc.collectFranchisePatterns({ keywords: ['mcu universe', 'action', 'marvel series'] }, 50);
        const queryArgs = db.query.mock.calls[0][1];
        expect(queryArgs[0]).toContain('mcu universe');
        expect(queryArgs[0]).toContain('marvel series');
        expect(queryArgs[0]).not.toContain('action');
    });

    test('swallows DB error and returns []', async () => {
        normalizeMetadataListLower.mockReturnValueOnce([]);
        db.query.mockRejectedValueOnce(new Error('DB down'));
        const result = await svc.collectFranchisePatterns(
            { collection: { name: 'MCU' }, keywords: [] },
            50
        );
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// collectGenrePatterns
// ---------------------------------------------------------------------------

describe('collectGenrePatterns', () => {
    test('queries with sorted genre combination', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await svc.collectGenrePatterns(['Comedy', 'Action'], 50);
        // Genres sorted: Action, Comedy
        expect(db.query.mock.calls[0][1][0]).toBe('Action,Comedy');
    });

    test('returns genre signal when pattern found', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 8, confidence: '72', sample_size: 10,
                status: 'approved', library_id: 1, library_name: 'Movies'
            }]
        });
        const result = await svc.collectGenrePatterns(['Thriller', 'Action'], 50);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('pattern_genre');
        expect(result[0].confidence).toBe(72);
    });

    test('returns [] when no matching pattern', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await svc.collectGenrePatterns(['Sci-Fi'], 50)).toEqual([]);
    });

    test('swallows DB error and returns []', async () => {
        db.query.mockRejectedValueOnce(new Error('DB down'));
        expect(await svc.collectGenrePatterns(['Action'], 50)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// collectCertificationPatterns
// ---------------------------------------------------------------------------

describe('collectCertificationPatterns', () => {
    test('returns certification signal when pattern found', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 3, confidence: '65', sample_size: 15,
                status: 'discovered', library_id: 2, library_name: 'Movies'
            }]
        });
        const result = await svc.collectCertificationPatterns('PG-13', 50);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('pattern_certification');
        expect(result[0].pattern_value).toBe('PG-13');
        expect(db.query.mock.calls[0][1]).toEqual(['PG-13', 50]);
    });

    test('returns [] when no matching pattern', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await svc.collectCertificationPatterns('NR', 50)).toEqual([]);
    });

    test('swallows DB error and returns []', async () => {
        db.query.mockRejectedValueOnce(new Error('DB down'));
        expect(await svc.collectCertificationPatterns('R', 50)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getBestMatch
// ---------------------------------------------------------------------------

describe('getBestMatch', () => {
    test('returns the first signal when signals available', async () => {
        const sig = { type: 'pattern_genre', confidence: 90 };
        jest.spyOn(svc, 'collectSignals').mockResolvedValueOnce([sig, { confidence: 70 }]);
        expect(await svc.getBestMatch({ genres: ['Action'] })).toBe(sig);
    });

    test('returns null when no signals found', async () => {
        jest.spyOn(svc, 'collectSignals').mockResolvedValueOnce([]);
        expect(await svc.getBestMatch({ genres: ['Unknown'] })).toBeNull();
    });
});
