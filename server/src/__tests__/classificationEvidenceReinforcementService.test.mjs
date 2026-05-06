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

const SIGNAL_TYPES = {
    PATTERN_STUDIO: 'pattern_studio',
    PATTERN_FRANCHISE: 'pattern_franchise',
    PATTERN_GENRE: 'pattern_genre',
    PATTERN_CERTIFICATION: 'pattern_certification',
    SOURCE_LIBRARY: 'source_library',
    MANUAL_CORRECTION: 'manual_correction',
    CUSTOM_RULE: 'custom_rule',
    EXISTING_MEDIA: 'existing_media',
    CONTENT_ANALYSIS: 'content_analysis',
    EXACT_MATCH: 'exact_match',
    COLLECTION_MATCH: 'collection_match',
    KEYWORD_MATCH: 'keyword_match',
    GENRE_MATCH: 'genre_match',
    SEMANTIC_SIMILARITY: 'semantic_similarity',
    PROFILE_SCORE: 'profile_score',
    PATTERN_KEYWORD: 'pattern_keyword',
};

const mockPatternReinforcementService = {
    reinforceOnAccept: jest.fn(),
    reinforceOnCorrection: jest.fn()
};
jest.unstable_mockModule('../services/patternReinforcementService.mjs', () => ({ ...mockPatternReinforcementService, default: mockPatternReinforcementService }));

const mockClassificationEvidenceService = {
    reinforceGenrePatterns: jest.fn()
};
jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => ({
    ...mockClassificationEvidenceService,
    classificationEvidenceService: mockClassificationEvidenceService
}));

const mockMetadataNormalization = {
    normalizeMetadataList: jest.fn()
};
jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => ({ ...mockMetadataNormalization, default: mockMetadataNormalization }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    })
}));

const mockSignalCollector = { SIGNAL_TYPES };
jest.unstable_mockModule('../services/signalCollector.mjs', () => ({ ...mockSignalCollector, default: mockSignalCollector }));

const patternReinforcementService = mockPatternReinforcementService;
const classificationEvidenceService = mockClassificationEvidenceService;
const { normalizeMetadataList } = mockMetadataNormalization;

let ClassificationEvidenceReinforcementService;

beforeAll(async () => {
    ({ ClassificationEvidenceReinforcementService } = await import('../services/classificationEvidenceReinforcementService.mjs'));
});

function makeService() {
    return new ClassificationEvidenceReinforcementService({
        legacyService: patternReinforcementService,
        evidenceService: classificationEvidenceService
    });
}

beforeEach(() => {
    patternReinforcementService.reinforceOnAccept.mockReset();
    patternReinforcementService.reinforceOnCorrection.mockReset();
    classificationEvidenceService.reinforceGenrePatterns.mockReset();
    normalizeMetadataList.mockReset();
    jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// reinforceOnAccept
// ---------------------------------------------------------------------------

describe('reinforceOnAccept', () => {
    test('delegates to legacy service', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue([]);

        const svc = makeService();
        const signals = [];
        await svc.reinforceOnAccept(1, signals, 5);

        expect(patternReinforcementService.reinforceOnAccept).toHaveBeenCalledWith(1, signals, 5);
    });

    test('does not call evidenceService when no genre signals', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue(['Action']);

        const svc = makeService();
        const nonGenreSignals = [{ type: SIGNAL_TYPES.PATTERN_KEYWORD, value: 'spy' }];
        await svc.reinforceOnAccept(1, nonGenreSignals, 5, {
            metadata: { genres: ['Action'] },
            mediaType: 'movie'
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });

    test('does not call evidenceService when mediaType is absent', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue(['Action']);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Action' }];
        await svc.reinforceOnAccept(1, genreSignals, 5, {
            metadata: { genres: ['Action'] },
            mediaType: null
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });

    test('does not call evidenceService when metadata is absent', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Action' }];
        await svc.reinforceOnAccept(1, genreSignals, 5, {
            metadata: null,
            mediaType: 'movie'
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });

    test('does not call evidenceService when genre list is empty after normalisation', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue([]);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Action' }];
        await svc.reinforceOnAccept(1, genreSignals, 5, {
            metadata: { genres: [] },
            mediaType: 'movie'
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });

    test('calls evidenceService with correct args when genre signals + metadata present', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        classificationEvidenceService.reinforceGenrePatterns.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue(['Action', 'Thriller']);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Action' }];
        await svc.reinforceOnAccept(1, genreSignals, 5, {
            metadata: { genres: ['Action', 'Thriller'] },
            mediaType: 'movie'
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).toHaveBeenCalledWith({
            mediaType: 'movie',
            libraryId: 5,
            genres: ['Action', 'Thriller'],
            createdBy: 'system_accept'
        });
    });

    test('evidenceService failure is swallowed (best-effort)', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();
        classificationEvidenceService.reinforceGenrePatterns.mockRejectedValueOnce(new Error('DB down'));
        normalizeMetadataList.mockReturnValue(['Action']);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Action' }];

        await expect(
            svc.reinforceOnAccept(1, genreSignals, 5, { metadata: { genres: ['Action'] }, mediaType: 'movie' })
        ).resolves.not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// reinforceOnCorrection
// ---------------------------------------------------------------------------

describe('reinforceOnCorrection', () => {
    test('delegates to legacy service', async () => {
        patternReinforcementService.reinforceOnCorrection.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue([]);

        const svc = makeService();
        const signals = [];
        await svc.reinforceOnCorrection(2, signals, 7);

        expect(patternReinforcementService.reinforceOnCorrection).toHaveBeenCalledWith(2, signals, 7);
    });

    test('calls evidenceService with createdBy=system_correction', async () => {
        patternReinforcementService.reinforceOnCorrection.mockResolvedValueOnce();
        classificationEvidenceService.reinforceGenrePatterns.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue(['Drama']);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Drama' }];
        await svc.reinforceOnCorrection(2, genreSignals, 7, {
            metadata: { genres: ['Drama'] },
            mediaType: 'show'
        });

        expect(classificationEvidenceService.reinforceGenrePatterns).toHaveBeenCalledWith({
            mediaType: 'show',
            libraryId: 7,
            genres: ['Drama'],
            createdBy: 'system_correction'
        });
    });

    test('evidenceService failure is swallowed (best-effort)', async () => {
        patternReinforcementService.reinforceOnCorrection.mockResolvedValueOnce();
        classificationEvidenceService.reinforceGenrePatterns.mockRejectedValueOnce(new Error('timeout'));
        normalizeMetadataList.mockReturnValue(['Drama']);

        const svc = makeService();
        const genreSignals = [{ type: SIGNAL_TYPES.PATTERN_GENRE, value: 'Drama' }];

        await expect(
            svc.reinforceOnCorrection(2, genreSignals, 7, { metadata: { genres: ['Drama'] }, mediaType: 'show' })
        ).resolves.not.toThrow();
    });

    test('does not call evidenceService when no genre signals', async () => {
        patternReinforcementService.reinforceOnCorrection.mockResolvedValueOnce();
        normalizeMetadataList.mockReturnValue(['Drama']);

        const svc = makeService();
        await svc.reinforceOnCorrection(2, [], 7, { metadata: { genres: ['Drama'] }, mediaType: 'show' });

        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// _reinforceGenreEvidence (via options defaulting)
// ---------------------------------------------------------------------------

describe('default options', () => {
    test('reinforceOnAccept works with no options argument', async () => {
        patternReinforcementService.reinforceOnAccept.mockResolvedValueOnce();

        const svc = makeService();
        await expect(svc.reinforceOnAccept(1, [], 5)).resolves.not.toThrow();
        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });

    test('reinforceOnCorrection works with no options argument', async () => {
        patternReinforcementService.reinforceOnCorrection.mockResolvedValueOnce();

        const svc = makeService();
        await expect(svc.reinforceOnCorrection(2, [], 7)).resolves.not.toThrow();
        expect(classificationEvidenceService.reinforceGenrePatterns).not.toHaveBeenCalled();
    });
});
