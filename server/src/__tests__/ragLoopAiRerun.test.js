/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const classificationService = require('../services/classification');
const ragLoopHelpers = require('../utils/ragLoopHelpers');
const db = require('../config/database');
const tmdbService = require('../services/tmdb');
const policyEngine = require('../services/policyEngine');
const confidenceCalculator = require('../services/confidenceCalculator');
const ragRetriever = require('../services/ragRetriever');
const ragLoopResilienceManager = require('../services/ragLoopResilienceManager');
const providerLock = require('../services/providerLock');
const ollamaService = require('../services/ollama');

// Mock dependencies
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

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock Date.now() to control budget
        // Start time = 1000
        mockDateNow = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => mockDateNow);

        // Default Mocks
        db.query.mockResolvedValue({ rows: [] });
        providerLock.acquireLock.mockResolvedValue(true);
        providerLock.config = { heartbeatInterval: 5000 };
        ollamaService.setGenerationStatus.mockImplementation(() => {});
        ollamaService.updateTokenCount.mockImplementation(() => {});
        
        // Mock Rag Loop Config - low confidence threshold to trigger rerun
        classificationService.getRagLoopConfig = jest.fn().mockReturnValue({
            rag_retrieval_loop_enabled: true,
            rag_loop_low_confidence_threshold: 80,
            rag_loop_conflict_detection_enabled: false,
            rag_loop_resilience_enabled: false, // disable resilience for this test to force execution
            policy_recheck_max_ai_calls_per_item: 2,
            policy_recheck_min_similarity_delta: 0.05,
            policy_recheck_min_margin_delta: 5,
            rag_loop_timeout_ms: 15000
        });

        // Mock Resilience Manager to always allow
        ragLoopResilienceManager.canRun = jest.fn().mockReturnValue({ allowed: true });
        
        // Mock Helper to ensure eligibility
        // We'll mock the actual function to ensure we satisfy the complex logic
        // or we can rely on careful data setup. Let's rely on data setup first 
        // but if it fails we might need to mock the helper.
        // Actually, we are testing classification.js which imports these. 
        // mocking the module require might be tricky if it's destructured.
        // Let's assume the real helper logic holds.
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('executes ai_rerun even when loop budget is exhausted', async () => {
        // SETUP:
        // 1. EvaluateRagLoopSecondPass is called with a "virtual" start time of 0.
        // 2. We advance MockDate to 14950 (assuming 15s budget) so remaining budget is minimal (<50ms).
        // 3. We ensure Pass 2 diagnostics show improvement so isAiRerunEligible returns true.
        // 4. We mock aiClassify to take 200ms "virtual time".
        
        const metadata = { title: 'Test', tmdb_id: 123, media_type: 'movie' };
        const libraries = [{ id: 1, name: 'Movies' }];
        const baselineResult = { 
            confidence: 60, 
            library: libraries[0],
            signalContext: { confidence: 60, preprocessingTime: 100 }
        };

        // Pass 1 diagnostics (low quality)
        const pass1Diagnostics = {
            matchCount: 1,
            topSimilarity: 0.5,
            marginPoints: 0
        };

        // Pass 2 diagnostics (high quality - improvement!)
        const pass2Matches = [{ libraryId: 1, similarity: 0.9 }];
        
        // Mock sub-functions called by evaluateRagLoopSecondPass
        ragRetriever.semanticSearch.mockResolvedValue(pass2Matches);
        ragRetriever.semanticSearchCandidates.mockResolvedValue(pass2Matches); // for diagnostics
        
        // IMPORTANT: Mock aiClassify to be SLOW
        const aiClassifySpy = jest.spyOn(classificationService, 'aiClassify').mockImplementation(async () => {
            // Function starts at t=14950
            // It "takes" 500ms
             mockDateNow += 500; 
             return {
                 confidence: 90,
                 library: libraries[0],
                 verified_by_ai: true,
                 reason: 'ai_rerun_success'
             };
        });

        // Set initial time close to timeout (assuming 15s default if not passed, 
        // but let's check how loop start is calculated. It uses Date.now() internally at start of loop?
        // No, evaluateRagLoopSecondPass takes what it gets. 
        // The budget is calculated as: loopTimeoutMs - (Date.now() - loopStart)
        // We need to inject loopStart or loopTimeoutMs? 
        // Looking at source: 
        // One arg is "config" which might have timeout? 
        // actually remainingBudget is a local helper in the closure. 
        // We can't easily injection-mock the internal remainingBudget variable logic 
        // unless we control the `evaluateRagLoopSecondPass` scope.
        
        // Wait, `evaluateRagLoopSecondPass` is a method on the service.
        // It defines: const loopStart = Date.now();
        // So if we set mockDateNow before calling it, that's loopStart.
        // Then inside the function, it calls other things (like ragRetriever).
        // We can make ragRetriever "advance" time to consume the budget.

        // 1. Start Loop
        mockDateNow = 1000; // Start
        
        // 2. Mock ragRetriever.semanticSearch (Pass 2) to consume LOTS of time
        // Default timeout is usually 15000ms.
        // We want remaining budget to be positive but small (e.g., 100ms)
        // so it Passes the "remainingBudget() > 0" check, 
        // but would have failed the old "Math.max(3000, budget)" timeout if it was stricter,
        // or specifically, we want to prove it waits for the 500ms aiClassify call.
        ragRetriever.semanticSearch.mockImplementation(async () => {
            // Advance time to 15900 (Start 1000 + 14900 elapsed)
            // Assuming 15000 timeout, budget = 100ms
            mockDateNow = 15900; 
            return [{ libraryId: 1, similarity: 0.9 }];
        });
        ragRetriever.hybridSearch.mockImplementation(async () => {
            mockDateNow = 15900;
            return [{ libraryId: 1, similarity: 0.9 }];
        });

        // 3. Mock ragRetriever.getSuggestedLibrary
        ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1, avgSimilarity: 0.9 });

        // 4. Mock dependencies for helpers
        policyEngine.evaluateItem.mockResolvedValue(null); // No policy update
        
        // Execute
        const result = await classificationService.evaluateRagLoopSecondPass({
            metadata,
            libraries,
            baselineResult,
            policyResult: null,
            signalContext: baselineResult.signalContext,
            ragContext: { similarItems: [{ libraryId: 1, similarity: 0.5 }] } // Pass 1 context
        });

        // Assertions
        // 1. Verify aiClassify WAS called (despite budget being < 0 after semanticSearch)
        expect(aiClassifySpy).toHaveBeenCalled();
        
        // 2. Verify result reflects AI outcome
        expect(result.confidence).toBe(90);
        expect(result.method).toBe('ai_verified'); // or whatever aiClassify returns mappings for
    });
});
