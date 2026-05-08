/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDatabase = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDatabase));

const mockEmbeddingRouter = { getConfig: jest.fn() };
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockRagLogger = { logOperation: jest.fn(), logError: jest.fn() };
jest.unstable_mockModule('../utils/ragLogger.mjs', () => createNamedMockModule('ragLogger', mockRagLogger));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const db = mockDatabase;
let patternMiningService;

beforeAll(async () => {
    ({ patternMiningService } = await import('../services/patternMiningService.mjs'));
});

describe('PatternMiningService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(patternMiningService, 'upsertPattern').mockResolvedValue({ id: 1, confidence: 90 });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('extractPatternValue handles string, name, tag, and title payloads', () => {
        expect(patternMiningService.extractPatternValue('Documentary')).toBe('Documentary');
        expect(patternMiningService.extractPatternValue('{"name":"Documentary"}')).toBe('Documentary');
        expect(patternMiningService.extractPatternValue('{"tag":"Pixar"}')).toBe('Pixar');
        expect(patternMiningService.extractPatternValue('{"title":"Studio Ghibli"}')).toBe('Studio Ghibli');
    });

    test('discoverGenrePatterns normalizes SQL extraction before grouping/upsert', async () => {
        db.query.mockResolvedValueOnce({
            rows: [
                { genre: 'Documentary', library_id: 1, library_name: 'Movies', confidence: '75', support_count: '6' }
            ]
        });

        const result = await patternMiningService.discoverGenrePatterns();

        expect(result).toEqual({ discovered: 1 });
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH normalized_genres AS'));
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("genre_item->>'name'"));
        expect(patternMiningService.upsertPattern).toHaveBeenCalledWith(
            'genre',
            'Documentary',
            1,
            'Movies',
            75,
            6
        );
    });

    test('discoverStudioPatterns normalizes SQL extraction before grouping/upsert', async () => {
        db.query.mockResolvedValueOnce({
            rows: [
                { studio: '{"name":"Pixar"}', library_id: 2, library_name: 'Family', confidence: '85', support_count: '4' }
            ]
        });

        const result = await patternMiningService.discoverStudioPatterns();

        expect(result).toEqual({ discovered: 1 });
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH normalized_studios AS'));
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("company->>'name'"));
        expect(patternMiningService.upsertPattern).toHaveBeenCalledWith(
            'studio',
            'Pixar',
            2,
            'Family',
            85,
            4
        );
    });
});
