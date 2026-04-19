/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for advisory vs strict preset semantics in PolicyEngine.
 */

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/patternSignalCollector', () => ({
    collectSignals: jest.fn()
}));

jest.mock('../services/ragRetriever', () => ({
    semanticSearch: jest.fn()
}));

jest.mock('../services/libraryProfileService', () => ({
    getProfileStats: jest.fn()
}));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: () => mockLogger
}));

const policyEngine = require('../services/policyEngine');

describe('PolicyEngine preset semantics', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('evaluatePresetSignals', () => {
        test('treats language require_any as advisory by default', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    require_any: ['ja'],
                    weight: 1.0
                }
            };

            const item = {
                genres: ['Animation', 'Action'],
                original_language: 'zh'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('handles object-shaped genres and keywords during preset evaluation', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                keywords: {
                    require_any: ['hero'],
                    weight: 1.0
                }
            };

            const item = {
                genres: [{ id: 16, name: 'Animation' }, { id: 28, name: 'Action' }],
                keywords: [{ id: 1, name: 'Hero' }],
                overview: 'Animated action adventure',
                title: 'Hero Movie'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('hard-blocks language require_any only when strict is true', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    require_any: ['ja'],
                    weight: 1.0,
                    strict: true
                }
            };

            const item = {
                genres: ['Animation', 'Action'],
                original_language: 'zh'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });

        test('treats language exclude as advisory by default', async () => {
            const signals = {
                genres: {
                    require_any: ['Comedy'],
                    weight: 1.0
                },
                language: {
                    exclude: ['en'],
                    weight: 1.0
                }
            };

            const item = {
                genres: ['Comedy'],
                original_language: 'en'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('hard-blocks language exclude only when strict is true', async () => {
            const signals = {
                genres: {
                    require_any: ['Comedy'],
                    weight: 1.0
                },
                language: {
                    exclude: ['en'],
                    weight: 1.0,
                    strict: true
                }
            };

            const item = {
                genres: ['Comedy'],
                original_language: 'en'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });

        test('treats media_type as a scored preset signal when it is the only configured signal', async () => {
            const signals = {
                media_type: {
                    include: ['movie'],
                    weight: 1.0
                }
            };

            const item = {
                media_type: 'movie'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(100);
        });

        test('returns neutral media_type score when the item is missing media_type', async () => {
            const signals = {
                media_type: {
                    include: ['movie'],
                    weight: 1.0
                }
            };

            const score = await policyEngine.evaluatePresetSignals(signals, {});
            expect(score).toBe(50);
        });
    });

    describe('evaluateItem', () => {
        test('keeps advisory language presets in ranked results', async () => {
            const policy = {
                id: 27,
                name: 'Regional Comedy Policy',
                library_id: 56,
                library_name: 'Comedy and Standup',
                library_media_type: 'movie',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_rag: false,
                rag_weight: 0,
                presets: [
                    {
                        signals: {
                            language: {
                                require_any: ['sv', 'no', 'da', 'fi'],
                                weight: 2.0
                            }
                        }
                    }
                ]
            };

            jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
            jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue([policy]);
            jest.spyOn(policyEngine, 'evaluatePolicy').mockResolvedValue({
                score: 72,
                library_id: 56,
                library_name: 'Comedy and Standup',
                policy_id: 27,
                policy_name: 'Regional Comedy Policy',
                auto_classify_threshold: 85,
                prompt_threshold: 60
            });

            const result = await policyEngine.evaluateItem({
                title: 'Taming the Garden',
                media_type: 'movie',
                original_language: 'ka'
            });

            expect(result.action).toBe('prompt_confirm');
            expect(result.ranked).toHaveLength(1);
            expect(result.ranked[0].library_name).toBe('Comedy and Standup');
            expect(result.languageConflicts).toEqual([]);
        });

        test('excludes strict language mismatch policies from ranked results', async () => {
            const policy = {
                id: 27,
                name: 'Regional Comedy Policy',
                library_id: 56,
                library_name: 'Comedy and Standup',
                library_media_type: 'movie',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_rag: false,
                rag_weight: 0,
                presets: [
                    {
                        signals: {
                            language: {
                                require_any: ['sv', 'no', 'da', 'fi'],
                                weight: 2.0,
                                strict: true
                            }
                        }
                    }
                ]
            };

            jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
            jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue([policy]);
            jest.spyOn(policyEngine, 'evaluatePolicy').mockResolvedValue({
                score: 72,
                library_id: 56,
                library_name: 'Comedy and Standup',
                policy_id: 27,
                policy_name: 'Regional Comedy Policy',
                auto_classify_threshold: 85,
                prompt_threshold: 60
            });

            const result = await policyEngine.evaluateItem({
                title: 'Taming the Garden',
                media_type: 'movie',
                original_language: 'ka'
            });

            expect(result.action).toBe('manual');
            expect(result.ranked).toEqual([]);
            expect(result.languageConflicts).toHaveLength(1);
            expect(result.languageConflicts[0]).toEqual(expect.objectContaining({
                policy_id: 27,
                library_name: 'Comedy and Standup',
                item_language: 'ka'
            }));
        });

        test('excludes strict English exclude policies from ranked results', async () => {
            const policy = {
                id: 31,
                name: 'Foreign Language Policy',
                library_id: 61,
                library_name: 'Foreign Language',
                library_media_type: 'movie',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_rag: false,
                rag_weight: 0,
                presets: [
                    {
                        signals: {
                            genres: {
                                require_any: ['Drama'],
                                weight: 1.0
                            },
                            language: {
                                exclude: ['en'],
                                weight: 1.0,
                                strict: true
                            }
                        }
                    }
                ]
            };

            jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
            jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue([policy]);
            jest.spyOn(policyEngine, 'evaluatePolicy').mockResolvedValue({
                score: 74,
                library_id: 61,
                library_name: 'Foreign Language',
                policy_id: 31,
                policy_name: 'Foreign Language Policy',
                auto_classify_threshold: 85,
                prompt_threshold: 60
            });

            const result = await policyEngine.evaluateItem({
                title: 'English Drama',
                media_type: 'movie',
                genres: ['Drama'],
                original_language: 'en'
            });

            expect(result.action).toBe('manual');
            expect(result.ranked).toEqual([]);
            expect(result.languageConflicts).toHaveLength(1);
            expect(result.languageConflicts[0]).toEqual(expect.objectContaining({
                policy_id: 31,
                library_name: 'Foreign Language',
                item_language: 'en',
                excluded_languages: ['en']
            }));
        });
    });
});
