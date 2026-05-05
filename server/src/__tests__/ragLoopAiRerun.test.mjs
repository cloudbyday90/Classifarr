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

const mockDb = { query: jest.fn() };

const mockPolicyEngine = { evaluateItem: jest.fn() };

const mockRagRetriever = {
  getSuggestedLibrary: jest.fn(),
  semanticSearch: jest.fn(),
  hybridSearch: jest.fn(),
  semanticSearchCandidates: jest.fn(),
};

const mockProviderLock = {
  acquireLock: jest.fn(),
  config: {},
};

const mockOllamaService = {
  setGenerationStatus: jest.fn(),
  updateTokenCount: jest.fn(),
};

const mockClassificationPhaseService = {
  updatePhase: jest.fn(),
  completeTracking: jest.fn(),
};

const mockTmdb = {};

const mockConfidenceCalculator = {};

const mockSignalCollector = {};
const mockSignalTypes = {
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
};

const mockMediaSync = {};

const mockLibraryProfileService = {};

const mockDiscordBot = {};

const mockContentTypeAnalyzer = {};

const mockPolicyQuestionBuilder = {
  build: jest.fn(),
};

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
};

jest.unstable_mockModule('../services/classificationPhaseService.mjs', () => ({
    ...mockClassificationPhaseService,
    classificationPhaseService: mockClassificationPhaseService
}));

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.unstable_mockModule('../services/policyEngine.mjs', () => ({ ...mockPolicyEngine, default: mockPolicyEngine }));

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => ({ ...mockConfidenceCalculator, default: mockConfidenceCalculator }));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({ ...mockRagRetriever, default: mockRagRetriever }));

jest.unstable_mockModule('../services/signalCollector.mjs', () => ({ SignalCollector: jest.fn(), SIGNAL_TYPES: mockSignalTypes, PATTERN_SIGNAL_TYPES: [], default: mockSignalCollector }));

jest.unstable_mockModule('../services/mediaSync.mjs', () => ({ ...mockMediaSync, default: mockMediaSync }));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({ ...mockLibraryProfileService, default: mockLibraryProfileService }));

jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => ({ ...mockContentTypeAnalyzer, default: mockContentTypeAnalyzer }));

jest.unstable_mockModule('../services/policyQuestionBuilder.mjs', () => ({ ...mockPolicyQuestionBuilder, default: mockPolicyQuestionBuilder }));

jest.unstable_mockModule('../services/providerLock.mjs', () => ({ ...mockProviderLock, default: mockProviderLock }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllamaService, default: mockOllamaService }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const db = mockDb;
const policyEngine = mockPolicyEngine;
const ragRetriever = mockRagRetriever;
const providerLock = mockProviderLock;
const ollamaService = mockOllamaService;

const { default: classificationService } = await import('../services/classification.mjs');
const { default: classificationRagLoopService } = await import('../services/classificationRagLoopService.mjs');
const { default: ragLoopResilienceManager } = await import('../services/ragLoopResilienceManager.mjs');

describe('RAG Loop AI Rerun Logic', () => {
    let mockDateNow;

    const setupBaseMocks = () => {
        db.query.mockResolvedValue({ rows: [] });
        providerLock.acquireLock.mockResolvedValue(true);
        providerLock.config = { heartbeatInterval: 5000 };
        ollamaService.setGenerationStatus.mockImplementation(() => {});
        ollamaService.updateTokenCount.mockImplementation(() => {});
        
        ragLoopResilienceManager.canRun = jest.fn().mockReturnValue({ allowed: true });
        
        policyEngine.evaluateItem.mockResolvedValue(null);
        
        ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1, avgSimilarity: 0.9 });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockDateNow = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => mockDateNow);
        setupBaseMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('ai_rerun execution conditions', () => {
        test('applies ai_rerun when material improvement gate is satisfied', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                rag_loop_rollout_mode: 'apply',
                policy_recheck_max_ai_calls_per_item: 2,
                policy_recheck_min_similarity_delta: 0,
                policy_recheck_min_margin_delta: 0,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = { 
                confidence: 60, 
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            // Pass2 retrieval is materially better than pass1 candidates.
            ragRetriever.semanticSearch.mockImplementation(async () => {
                mockDateNow = 20000;
                return [{ libraryId: 1, similarity: 0.95, libraryName: 'Movies' }];
            });
            ragRetriever.hybridSearch.mockImplementation(async () => {
                mockDateNow = 20000;
                return [{ libraryId: 1, similarity: 0.95, libraryName: 'Movies' }];
            });
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.50, libraryName: 'Movies' }
            ]);

            const aiClassifySpy = jest.spyOn(classificationRagLoopService, 'aiClassify').mockImplementation(async () => {
                mockDateNow += 500;
                return {
                    confidence: 90,
                    library: libraries[0],
                    verified_by_ai: true,
                    reason: 'ai_rerun_success'
                };
            });

            const result = await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: { 
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }] 
                }
            });

            expect(aiClassifySpy).toHaveBeenCalledTimes(1);
            const aiRerunEvent = result.ragLoopLogContext.events.find(e => e.stage === 'ai_rerun');
            expect(aiRerunEvent).toBeDefined();
            expect(aiRerunEvent.outcome).toBe('applied');
            expect(result.confidence).toBeGreaterThanOrEqual(60);
        });

        test('skips ai_rerun when no material improvement', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                rag_loop_rollout_mode: 'apply',
                policy_recheck_max_ai_calls_per_item: 2,
                policy_recheck_min_similarity_delta: 0.50,
                policy_recheck_min_margin_delta: 50,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = { 
                confidence: 60, 
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.55, libraryName: 'Movies' }
            ]);
            ragRetriever.hybridSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.55, libraryName: 'Movies' }
            ]);
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.55, libraryName: 'Movies' }
            ]);

            const aiClassifySpy = jest.spyOn(classificationRagLoopService, 'aiClassify').mockImplementation(async () => ({
                confidence: 90,
                library: libraries[0],
                verified_by_ai: true
            }));

            await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: { 
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }] 
                }
            });

            expect(aiClassifySpy).not.toHaveBeenCalled();
        });

        test('skips ai_rerun when ai call budget exhausted', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                policy_recheck_max_ai_calls_per_item: 1,
                policy_recheck_min_similarity_delta: 0.05,
                policy_recheck_min_margin_delta: 5,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = { 
                confidence: 60, 
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.hybridSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.50, libraryName: 'Movies' }
            ]);

            const aiClassifySpy = jest.spyOn(classificationRagLoopService, 'aiClassify').mockImplementation(async () => ({
                confidence: 90,
                library: libraries[0],
                verified_by_ai: true
            }));

            await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: { 
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }] 
                }
            });

            expect(aiClassifySpy).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        test('records transient ai_rerun skips with the specific retry reason code', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                policy_recheck_max_ai_calls_per_item: 2,
                policy_recheck_min_similarity_delta: 0,
                policy_recheck_min_margin_delta: 0,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = {
                confidence: 60,
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.hybridSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.50, libraryName: 'Movies' }
            ]);

            const transientError = new Error('Generation ended before completion signal');
            transientError.code = 'EINCOMPLETE';

            jest.spyOn(classificationRagLoopService, 'aiClassify').mockRejectedValue(transientError);

            const result = await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: {
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }]
                }
            });

            const aiRerunEvent = result.ragLoopLogContext.events.find(e => e.stage === 'ai_rerun');
            expect(aiRerunEvent).toBeDefined();
            expect(aiRerunEvent.outcome).toBe('skipped');
            expect(aiRerunEvent.reason_code).toBe('ai_stream_incomplete');
        });

        test('records error event when ai_rerun execution fails with non-transient error', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                policy_recheck_max_ai_calls_per_item: 2,
                policy_recheck_min_similarity_delta: 0,
                policy_recheck_min_margin_delta: 0,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = { 
                confidence: 60, 
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.hybridSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.50, libraryName: 'Movies' }
            ]);

            const testError = new Error('AI response parse failure');
            testError.code = 'EPARSE';
            
            jest.spyOn(classificationRagLoopService, 'aiClassify').mockRejectedValue(testError);

            const result = await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: { 
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }] 
                }
            });

            expect(result.ragLoopLogContext).toBeDefined();
            const aiRerunEvent = result.ragLoopLogContext.events.find(e => e.stage === 'ai_rerun');
            expect(aiRerunEvent).toBeDefined();
            expect(aiRerunEvent.outcome).toBe('error');
        });

        test('records error event when mocked ai error object is non-standard', async () => {
            classificationRagLoopService.getRagLoopConfig = jest.fn().mockReturnValue({
                rag_retrieval_loop_enabled: true,
                rag_loop_low_confidence_threshold: 80,
                rag_loop_conflict_detection_enabled: false,
                rag_loop_resilience_enabled: false,
                policy_recheck_max_ai_calls_per_item: 2,
                policy_recheck_min_similarity_delta: 0,
                policy_recheck_min_margin_delta: 0,
                rag_loop_timeout_ms: 15000
            });

            const metadata = { title: 'Test Movie', tmdb_id: 123, media_type: 'movie' };
            const libraries = [{ id: 1, name: 'Movies' }];
            const baselineResult = { 
                confidence: 60, 
                library: libraries[0],
                signalContext: { confidence: 60, preprocessingTime: 100 }
            };

            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.hybridSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);
            ragRetriever.semanticSearchCandidates.mockResolvedValue([
                { libraryId: 1, similarity: 0.95, libraryName: 'Movies' }
            ]);

            const weirdError = { code: 'WEIRD_ERROR' };
            
            jest.spyOn(classificationRagLoopService, 'aiClassify').mockRejectedValue(weirdError);

            const result = await classificationService.evaluateRagLoopSecondPass({
                metadata,
                libraries,
                baselineResult,
                policyResult: null,
                signalContext: baselineResult.signalContext,
                ragContext: { 
                    similarItems: [{ libraryId: 1, similarity: 0.5, libraryName: 'Movies' }] 
                }
            });

            const aiRerunEvent = result.ragLoopLogContext.events.find(e => e.stage === 'ai_rerun');
            expect(aiRerunEvent).toBeDefined();
            expect(aiRerunEvent.outcome).toBe('error');
        });
    });
});
