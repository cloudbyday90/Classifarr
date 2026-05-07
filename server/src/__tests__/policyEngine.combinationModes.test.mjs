/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for policy preset combination modes.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockPatternSignalCollector = { collectSignals: jest.fn() };
const mockRagRetriever = { semanticSearch: jest.fn() };
const mockLibraryProfileService = { getProfileScore: jest.fn().mockResolvedValue(0) };

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
const mockLoggerModule = { createLogger: () => mockLogger };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/patternSignalCollector.mjs', () => ({
    ...mockPatternSignalCollector,
    patternSignalCollector: mockPatternSignalCollector,
}));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => createNamedMockModule('ragRetriever', mockRagRetriever));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const { policyEngine } = await import('../services/policyEngine.mjs');

describe('PolicyEngine combination modes', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    test('best_match uses the highest preset score', async () => {
        const presets = [
            { signals: { genres: { require_any: ['Action'] } }, weight: 0.2 },
            { signals: { genres: { require_any: ['Comedy'] } }, weight: 5.0 }
        ];

        const item = { genres: ['Action'], media_type: 'movie' };

        const score = await policyEngine.scorePresets(presets, item, 'best_match');

        expect(score).toBe(80);
    });

    test('average uses the arithmetic mean across attached presets', async () => {
        const presets = [
            { signals: { genres: { require_any: ['Action'] } }, weight: 0.2 },
            { signals: { genres: { require_any: ['Comedy'] } }, weight: 5.0 }
        ];

        const item = { genres: ['Action'], media_type: 'movie' };

        const score = await policyEngine.scorePresets(presets, item, 'average');

        expect(score).toBe(40);
    });

    test('weighted_average uses preset weights', async () => {
        const presets = [
            { signals: { genres: { require_any: ['Action'] } }, weight: 1.0 },
            { signals: { genres: { require_any: ['Comedy'] } }, weight: 3.0 }
        ];

        const item = { genres: ['Action'], media_type: 'movie' };

        const score = await policyEngine.scorePresets(presets, item, 'weighted_average');

        expect(score).toBe(20);
    });

    test('weighted_average ignores legacy non-positive preset weights by normalizing them to 1.0', async () => {
        const presets = [
            { signals: { genres: { require_any: ['Action'] } }, weight: -2.0 },
            { signals: { genres: { require_any: ['Comedy'] } }, weight: 0 }
        ];

        const item = { genres: ['Action'], media_type: 'movie' };

        const score = await policyEngine.scorePresets(presets, item, 'weighted_average');

        expect(score).toBe(40);
    });

    test('require_all returns 0 when any preset does not match', async () => {
        const presets = [
            { signals: { genres: { require_any: ['Action'] } }, weight: 1.0 },
            { signals: { genres: { require_any: ['Comedy'] } }, weight: 1.0 }
        ];

        const item = { genres: ['Action'], media_type: 'movie' };

        const score = await policyEngine.scorePresets(presets, item, 'require_all');

        expect(score).toBe(0);
    });

    test('evaluatePolicy honors stored best_match combination mode', async () => {
        jest.spyOn(policyEngine, 'scoreProfile').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scorePatterns').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scoreRAG').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scoreHistory').mockResolvedValue(0);

        const policy = {
            id: 8,
            name: 'Best Match Policy',
            library_id: 4,
            library_name: 'Movies',
            combination_mode: 'best_match',
            auto_classify_threshold: 85,
            prompt_threshold: 60,
            trust_patterns: false,
            trust_rag: false,
            trust_history: false,
            preset_weight: 1.0,
            profile_weight: 0.0,
            pattern_weight: 0.0,
            rag_weight: 0.0,
            history_weight: 0.0,
            presets: [
                { signals: { genres: { require_any: ['Action'] } }, weight: 0.2 },
                { signals: { genres: { require_any: ['Comedy'] } }, weight: 5.0 }
            ]
        };

        const item = { genres: ['Action'], media_type: 'movie' };
        const result = await policyEngine.evaluatePolicy(policy, item);

        expect(result.scores.preset).toBe(80);
        expect(result.combination_mode).toBe('best_match');
        expect(result.score).toBe(80);
    });

    test('evaluatePolicy does not dilute preset-only matches with zero-contribution signals', async () => {
        jest.spyOn(policyEngine, 'scorePresets').mockResolvedValue(95);
        jest.spyOn(policyEngine, 'scoreProfile').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scorePatterns').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scoreRAG').mockResolvedValue(0);
        jest.spyOn(policyEngine, 'scoreHistory').mockResolvedValue(0);

        const policy = {
            id: 12,
            name: 'Preset Heavy Policy',
            library_id: 5,
            library_name: 'Movies',
            combination_mode: 'weighted_average',
            auto_classify_threshold: 85,
            prompt_threshold: 60,
            trust_patterns: true,
            trust_rag: true,
            trust_history: true,
            preset_weight: 0.35,
            profile_weight: 0.25,
            pattern_weight: 0.15,
            rag_weight: 0.15,
            history_weight: 0.10,
            presets: [
                { signals: { genres: { require_any: ['Action'] } }, weight: 1.0 }
            ]
        };

        const result = await policyEngine.evaluatePolicy(policy, { genres: ['Action'], media_type: 'movie' });

        expect(result.score).toBe(95);
        expect(result.breakdown).toEqual([
            expect.objectContaining({ type: 'preset', score: 95, weight: 0.35, activeWeight: 0.35 }),
            expect.objectContaining({ type: 'profile', score: 0, weight: 0.25, activeWeight: 0 }),
            expect.objectContaining({ type: 'pattern', score: 0, weight: 0.15, activeWeight: 0 }),
            expect.objectContaining({ type: 'rag', score: 0, weight: 0.15, activeWeight: 0 }),
            expect.objectContaining({ type: 'history', score: 0, weight: 0.10, activeWeight: 0 })
        ]);
    });
});
