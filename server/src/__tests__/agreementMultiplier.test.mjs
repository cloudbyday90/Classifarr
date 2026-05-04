/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

const mockDatabase = { query: jest.fn() };
jest.mock('../config/database', () => mockDatabase);
jest.unstable_mockModule('../config/database', () => ({ ...mockDatabase, default: mockDatabase }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDatabase, default: mockDatabase }));

jest.mock('../services/ragRetriever', () => ({}));
jest.unstable_mockModule('../services/ragRetriever', () => ({ default: {} }));
jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({ default: {} }));

jest.mock('../services/libraryProfileService', () => ({}));
jest.unstable_mockModule('../services/libraryProfileService', () => ({ default: {} }));
jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({ default: {} }));

jest.mock('../services/patternSignalCollector', () => ({}));
jest.unstable_mockModule('../services/patternSignalCollector', () => ({ default: {} }));
jest.unstable_mockModule('../services/patternSignalCollector.mjs', () => ({ default: {} }));

let policyEngine;
let FORMULA_CONFIDENCE_CAP;

beforeAll(async () => {
    const mod = await import('../services/policyEngine.mjs');
    policyEngine = mod.default;
    FORMULA_CONFIDENCE_CAP = mod.FORMULA_CONFIDENCE_CAP;
});

describe('PolicyEngine.calculateAgreementMultiplier', () => {
    let calc;
    beforeAll(() => {
        calc = policyEngine.calculateAgreementMultiplier.bind(policyEngine);
    });

    const fullPolicy = {
        presets: [{ id: 1 }],
        trust_patterns: true,
        trust_rag: true,
        trust_history: true
    };

    test('returns 1.0 when 0 or 1 signals contribute', () => {
        const result0 = calc(
            { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
            fullPolicy
        );
        expect(result0.multiplier).toBe(1.0);
        expect(result0.contributing).toBe(0);

        const result1 = calc(
            { preset: 0, profile: 60, pattern: 0, rag: 0, history: 0 },
            fullPolicy
        );
        expect(result1.multiplier).toBe(1.0);
        expect(result1.contributing).toBe(1);
    });

    test('returns 1.05 for 2 contributing signals', () => {
        const result = calc(
            { preset: 80, profile: 60, pattern: 0, rag: 0, history: 0 },
            fullPolicy
        );
        expect(result.multiplier).toBe(1.05);
        expect(result.contributing).toBe(2);
    });

    test('returns 1.12 for 3 contributing signals', () => {
        const result = calc(
            { preset: 80, profile: 60, pattern: 50, rag: 0, history: 0 },
            fullPolicy
        );
        expect(result.multiplier).toBe(1.12);
        expect(result.contributing).toBe(3);
    });

    test('returns 1.20 for 4 contributing signals', () => {
        const result = calc(
            { preset: 80, profile: 60, pattern: 50, rag: 45, history: 0 },
            fullPolicy
        );
        expect(result.multiplier).toBe(1.20);
        expect(result.contributing).toBe(4);
    });

    test('returns 1.30 for 5 contributing signals (unanimous)', () => {
        const result = calc(
            { preset: 80, profile: 60, pattern: 50, rag: 45, history: 35 },
            fullPolicy
        );
        expect(result.multiplier).toBe(1.30);
        expect(result.contributing).toBe(5);
    });

    test('only counts enabled signals', () => {
        const noTrustPolicy = {
            presets: [],
            trust_patterns: false,
            trust_rag: false,
            trust_history: false
        };

        const result = calc(
            { preset: 80, profile: 60, pattern: 50, rag: 45, history: 35 },
            noTrustPolicy
        );
        expect(result.contributing).toBe(1); // only profile
        expect(result.multiplier).toBe(1.0);
    });

    test('boosted score stays capped at FORMULA_CONFIDENCE_CAP (95)', () => {
        const scores = { preset: 90, profile: 90, pattern: 90, rag: 90, history: 90 };
        const agreement = calc(scores, fullPolicy);
        const boosted = Math.min(90 * agreement.multiplier, FORMULA_CONFIDENCE_CAP);
        expect(boosted).toBe(FORMULA_CONFIDENCE_CAP);
    });
});
