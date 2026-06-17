/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for advisory vs strict preset semantics in PolicyEngine.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockPatternSignalCollector = { collectSignals: jest.fn() };
const mockRagRetriever = { semanticSearch: jest.fn() };
const mockLibraryProfileService = { getProfileStats: jest.fn() };

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

        test('hard-blocks genres require_any when strict is true', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    strict: true,
                    weight: 2.0
                },
                keywords: {
                    prefer: ['animated', 'cartoon'],
                    weight: 0.5
                }
            };

            const item = {
                genres: ['Action', 'Thriller'],
                overview: 'A live-action thriller film.'
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

        test('does not let media_type rescue an anime preset when no affirmative anime evidence matches', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                keywords: {
                    require_any: ['anime'],
                    weight: 2.0
                },
                language: {
                    prefer: ['ja'],
                    weight: 1.0
                },
                media_type: {
                    include: ['tv'],
                    weight: 1.0
                }
            };

            const item = {
                media_type: 'tv',
                genres: ['Drama', 'Romance'],
                keywords: ['college', 'relationship'],
                original_language: 'en',
                overview: 'A live-action college drama series.'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });

        test('allows explicit compatibility semantics to keep a preset advisory-only', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0,
                    semantics: 'compatibility'
                },
                keywords: {
                    require_any: ['anime'],
                    weight: 2.0,
                    semantics: 'compatibility'
                },
                media_type: {
                    include: ['tv'],
                    weight: 1.0
                }
            };

            const item = {
                media_type: 'tv',
                genres: ['Drama', 'Romance'],
                keywords: ['college', 'relationship'],
                overview: 'A live-action college drama series.'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('allows explicit identity semantics on compatibility-style signals', async () => {
            const signals = {
                media_type: {
                    include: ['movie'],
                    weight: 1.0,
                    semantics: 'identity'
                },
                release_year: {
                    min: 2020,
                    max: 2026,
                    weight: 1.0,
                    semantics: 'compatibility'
                }
            };

            const item = {
                media_type: 'movie',
                year: 2024
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(100);
        });

        test('still boosts confidence when at least one affirmative preset signal matches', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                keywords: {
                    require_any: ['anime'],
                    weight: 2.0
                },
                language: {
                    prefer: ['ja'],
                    weight: 1.0
                },
                media_type: {
                    include: ['tv'],
                    weight: 1.0
                }
            };

            const item = {
                media_type: 'tv',
                genres: ['Animation', 'Action'],
                keywords: ['fantasy'],
                original_language: 'en',
                overview: 'An animated action series.'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });
    });

    describe('scorePresets', () => {
        test('returns zero for anime presets when a tv item lacks anime evidence', async () => {
            const presets = [
                {
                    signals: {
                        genres: { require_any: ['Animation'], weight: 1.0 },
                        keywords: { require_any: ['anime'], prefer: ['manga', 'shonen'], weight: 1.5 },
                        language: { prefer: ['ja'], weight: 1.0 }
                    },
                    weight: 1.0
                },
                {
                    signals: {
                        genres: { require_any: ['Animation'], weight: 1.0 },
                        keywords: { require_any: ['anime'], weight: 2.0 },
                        language: { prefer: ['ja'], weight: 1.0 },
                        media_type: { include: ['tv'], weight: 1.0 }
                    },
                    weight: 1.0
                }
            ];

            const item = {
                media_type: 'tv',
                genres: ['Drama', 'Romance'],
                keywords: ['college', 'relationship'],
                original_language: 'en',
                overview: 'A live-action college drama series.'
            };

            const score = await policyEngine.scorePresets(presets, item, 'best_match');
            expect(score).toBe(0);
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

        test('excludes strict certification boundary policies from ranked results', async () => {
            const policy = {
                id: 41,
                name: 'Family Policy',
                library_id: 14,
                library_name: 'Family',
                library_media_type: 'movie',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_rag: false,
                rag_weight: 0,
                presets: [
                    {
                        signals: {
                            genres: {
                                require_any: ['Comedy'],
                                weight: 1.0
                            },
                            certifications: {
                                mode: 'max',
                                max: 'PG-13',
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
                score: 88,
                library_id: 14,
                library_name: 'Family',
                policy_id: 41,
                policy_name: 'Family Policy',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
            });

            const result = await policyEngine.evaluateItem({
                title: 'Office Romance',
                media_type: 'movie',
                genres: ['Romance', 'Comedy'],
                certification: 'R',
                original_language: 'en'
            });

            expect(result.action).toBe('manual');
            expect(result.ranked).toEqual([]);
            expect(result.constraintConflicts).toHaveLength(1);
            expect(result.constraintConflicts[0]).toEqual(expect.objectContaining({
                policy_id: 41,
                library_name: 'Family',
                signal_type: 'certifications',
                reason_code: 'certification_above_max',
                actual: 'R'
            }));
            expect(result.languageConflicts).toEqual([]);
        });
    });
});
