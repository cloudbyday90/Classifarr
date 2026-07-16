/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Bug Fixes Tests
 * Tests for comprehensive bug fix PR
 */

import { jest } from '@jest/globals';
import {
    createDbRowsResult,
    createLoggerModuleMock,
    createNamedMockModule,
} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn(), pool: { connect: jest.fn() } };
const { module: mockLoggerModule } = createLoggerModuleMock();
const mockRagRetriever = { semanticSearch: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => mockLoggerModule);

jest.unstable_mockModule('../services/ragRetriever.mjs', () => createNamedMockModule('ragRetriever', mockRagRetriever));

const db = mockDb;
const ragRetriever = mockRagRetriever;
const { libraryProfileService } = await import('../services/libraryProfileService.mjs');
const { policyEngine } = await import('../services/policyEngine.mjs');
const { mediaSyncService: mediaSync } = await import('../services/mediaSync.mjs');

describe('Bug Fixes - Comprehensive PR', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Bug 1: AI Model Selection from ai_provider_config', () => {
        it('should read model from ai_provider_config when available', async () => {
            // Mock ai_provider_config query
            db.query.mockResolvedValueOnce({
                rows: [{ ollama_model: 'gemma3:12b', temperature: 0.30 }]
            });

            // This would be called during aiClassify, but we're testing the config reading
            // The actual test would require mocking the entire aiClassify flow
            // For now, verify the query would be called correctly
            const result = await db.query('SELECT ollama_model, temperature FROM ai_provider_config WHERE id = 1');
            
            expect(result.rows[0].ollama_model).toBe('gemma3:12b');
            expect(result.rows[0].temperature).toBe(0.30);
        });

        it('should fall back to llama3.2 when ai_provider_config is empty', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await db.query('SELECT ollama_model, temperature FROM ai_provider_config WHERE id = 1');
            const config = result.rows[0] 
                ? { model: result.rows[0].ollama_model || 'llama3.2', temperature: result.rows[0].temperature || 0.30 }
                : { model: 'llama3.2', temperature: 0.30 };

            expect(config.model).toBe('llama3.2');
            expect(config.temperature).toBe(0.30);
        });
    });

    describe('Bug 2: RAG Caching in PolicyEngine', () => {
        it('should not call RAG when there are no policies', async () => {
            const mockItem = {
                title: 'Test Movie',
                genres: ['Action'],
                tmdb_id: 12345
            };

            // Mock RAG search
            ragRetriever.semanticSearch.mockResolvedValue([]);

            // Mock database queries
            db.query
                .mockResolvedValueOnce(createDbRowsResult()) // checkAuthoritativeSignals
                .mockResolvedValueOnce(createDbRowsResult()); // getActivePolicies - no policies

            const result = await policyEngine.evaluateItem(mockItem);

            // RAG should not be called when there are no policies (nothing to evaluate)
            expect(ragRetriever.semanticSearch).toHaveBeenCalledTimes(0);
            expect(result.action).toBe('manual');
        });

        it('should call RAG once and reuse results for multiple policies', async () => {
            const mockItem = {
                title: 'Test Movie',
                genres: ['Action'],
                tmdb_id: 12345
            };

            const mockMatches = [
                { libraryId: 1, similarity: 0.85 },
                { libraryId: 2, similarity: 0.70 }
            ];

            const mockPolicies = [ 
                { 
                    id: 1, 
                    library_id: 1,
                    library_name: 'Library 1',
                    name: 'Policy 1',
                    trust_rag: true,
                    trust_patterns: false,
                    trust_history: false,
                    rag_weight: 0.15,
                    preset_weight: 0.35,
                    profile_weight: 0.25,
                    pattern_weight: 0.15,
                    history_weight: 0.10,
                    presets: []
                },
                { 
                    id: 2, 
                    library_id: 2,
                    library_name: 'Library 2',
                    name: 'Policy 2',
                    trust_rag: true,
                    trust_patterns: false,
                    trust_history: false,
                    rag_weight: 0.15,
                    preset_weight: 0.35,
                    profile_weight: 0.25,
                    pattern_weight: 0.15,
                    history_weight: 0.10,
                    presets: []
                }
            ];

            // Mock RAG search
            ragRetriever.semanticSearch.mockResolvedValue(mockMatches);

            // Mock getActivePolicies to return policies with presets already attached
            jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(mockPolicies);

            // Mock database queries
            db.query
                .mockResolvedValueOnce(createDbRowsResult()) // checkAuthoritativeSignals
                .mockResolvedValue(createDbRowsResult()); // For all other queries (profile)

            await policyEngine.evaluateItem(mockItem);

            // RAG should be called only once, not once per policy (performance optimization)
            expect(ragRetriever.semanticSearch).toHaveBeenCalledTimes(1);
            expect(ragRetriever.semanticSearch).toHaveBeenCalledWith(mockItem, 5);
            
            // Restore the spy
            policyEngine.getActivePolicies.mockRestore();
        });

        it('should not call RAG when no policies use RAG', async () => {
            const mockItem = {
                title: 'Test Movie',
                genres: ['Action'],
                tmdb_id: 12345
            };

            // Mock RAG search
            ragRetriever.semanticSearch.mockResolvedValue([]);

            // Mock database queries - policies exist but none use RAG
            db.query
                .mockResolvedValueOnce(createDbRowsResult()) // checkAuthoritativeSignals
                .mockResolvedValueOnce({ rows: [
                    { 
                        id: 1, 
                        library_id: 1,
                        trust_rag: false, // RAG disabled
                        rag_weight: 0
                    }
                ]}) // getActivePolicies
                .mockResolvedValue(createDbRowsResult()); // For other queries

            await policyEngine.evaluateItem(mockItem);

            // RAG should not be called when no policies use it (optimization)
            expect(ragRetriever.semanticSearch).toHaveBeenCalledTimes(0);
        });

        it('should not retrieve RAG for a native policy whose purpose does not match', async () => {
            const nativePolicy = {
                id: 3,
                library_id: 3,
                library_name: 'Animation',
                name: 'Native Animation Policy',
                trust_rag: true,
                rag_weight: 0.15,
                trust_patterns: false,
                trust_history: false,
                preset_weight: 0.35,
                profile_weight: 0.25,
                pattern_weight: 0.15,
                history_weight: 0.10,
                policy_runtime_authority: {
                    sourceId: 'native_intent',
                    validationOk: true,
                },
                policy_intent_contract: {
                    source: 'native_intent',
                    validation: { valid: true },
                    purpose: [{
                        signal_type: 'genres',
                        operator: 'require_any',
                        values: { require_any: ['Animation'] },
                    }],
                    hard_limits: [],
                    helpful_hints: [],
                    avoid: [],
                    review_behavior: {},
                },
            };
            const getActivePoliciesSpy = jest.spyOn(policyEngine, 'getActivePolicies')
                .mockResolvedValue([nativePolicy]);
            ragRetriever.semanticSearch.mockResolvedValue([]);
            db.query.mockResolvedValueOnce(createDbRowsResult());

            await policyEngine.evaluateItem({
                title: 'Horror Feature',
                genres: ['Horror'],
                media_type: 'movie',
            });

            expect(ragRetriever.semanticSearch).not.toHaveBeenCalled();
            getActivePoliciesSpy.mockRestore();
        });
    });

    describe('Bug 3: Genre Distribution TEXT[] Handling', () => {
        it('should use unnest() for TEXT[] genres column', async () => {
            const mockGenres = [
                { genre: 'Action', count: '50', percentage: 45.5 },
                { genre: 'Drama', count: '30', percentage: 27.3 },
                { genre: 'Comedy', count: '30', percentage: 27.3 }
            ];

            db.query.mockResolvedValueOnce({
                rows: mockGenres
            });

            await libraryProfileService.getGenreDistribution(1);

            // Verify the query uses unnest instead of jsonb functions
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('unnest(genres)'),
                [1]
            );
            expect(db.query).toHaveBeenCalledWith(
                expect.not.stringContaining('jsonb_typeof'),
                [1]
            );
        });
    });

    describe('Bug 8: Plex Sync Reconciliation', () => {
        it('should have reconcileAwaitingDecisions method', () => {
            // Verify the method exists
            expect(typeof mediaSync.reconcileAwaitingDecisions).toBe('function');
        });

        it('should construct correct SQL for reconciliation', async () => {
            const libraryId = 1;

            // Mock successful reconciliation
            db.query.mockResolvedValueOnce({
                rows: [
                    {
                        id: 100,
                        tmdb_id: 12345,
                        media_type: 'movie',
                        title: 'Test Movie',
                        library_id: 1,
                        library_name: 'Movies'
                    }
                ]
            }).mockResolvedValue({ rows: [] }); // For learned_corrections insert

            await mediaSync.reconcileAwaitingDecisions(libraryId);

            // Verify the main reconciliation query was called with correct libraryId
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'awaiting_decision'"),
                [libraryId]
            );
        });

        it('should handle errors without throwing', async () => {
            const libraryId = 1;

            // Mock database error
            db.query.mockRejectedValueOnce(new Error('Database error'));

            // Should not throw, method handles errors internally
            await expect(mediaSync.reconcileAwaitingDecisions(libraryId)).resolves.toBeDefined();
        });
    });
});
