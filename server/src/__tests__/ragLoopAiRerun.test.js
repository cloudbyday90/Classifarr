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

const classificationService = require('../services/classification');
const db = require('../config/database');
const policyEngine = require('../services/policyEngine');
const ragRetriever = require('../services/ragRetriever');
const ragLoopResilienceManager = require('../services/ragLoopResilienceManager');
const providerLock = require('../services/providerLock');
const ollamaService = require('../services/ollama');

jest.mock('../services/classificationPhaseService', () => ({
  updatePhase: jest.fn(),
  completeTracking: jest.fn()
}));
jest.mock('../config/database');
jest.mock('../services/tmdb');
jest.mock('../services/policyEngine');
jest.mock('../services/confidenceCalculator');
jest.mock('../services/ragRetriever');
jest.mock('../services/signalCollector');
jest.mock('../services/mediaSync');
jest.mock('../services/libraryProfileService');
jest.mock('../services/discordBot');
jest.mock('../services/contentTypeAnalyzer');
jest.mock('../services/policyQuestionBuilder', () => ({
  build: jest.fn()
}));
jest.mock('../services/providerLock');
jest.mock('../services/ollama');
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

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
            classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
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

            const aiClassifySpy = jest.spyOn(classificationService, 'aiClassify').mockImplementation(async () => {
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
            classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
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

            const aiClassifySpy = jest.spyOn(classificationService, 'aiClassify').mockImplementation(async () => ({
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
            classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
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

            const aiClassifySpy = jest.spyOn(classificationService, 'aiClassify').mockImplementation(async () => ({
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
        test('records error event when ai_rerun execution fails with non-transient error', async () => {
            classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
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

            const testError = new Error('Ollama connection failed');
            testError.code = 'ECONNREFUSED';
            
            jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(testError);
            jest.spyOn(classificationService, 'isAiTransientAvailabilityError').mockReturnValue(false);

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
            classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
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
            
            jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(weirdError);
            jest.spyOn(classificationService, 'isAiTransientAvailabilityError').mockReturnValue(false);

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
