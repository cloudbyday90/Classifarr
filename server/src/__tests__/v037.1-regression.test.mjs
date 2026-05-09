/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Regression tests for v0.37.1-alpha fixes:
 * 1. Scheduler import fix (runGapAnalysis vs runPatternAnalysis)
 * 2. Media sync FK constraint fix (library existence check)
 * 3. Tavily result parsing fix (results array extraction)
 */

import { schedulerService as scheduler } from '../services/scheduler.mjs';
import { schedulerService } from '../services/schedulerService.mjs';
import { mediaSyncService as mediaSync } from '../services/mediaSync.mjs';
import { enrichmentRetryService } from '../services/enrichmentRetryService.mjs';

describe('v0.37.1 Regression Tests', () => {
    describe('Scheduler Module Imports', () => {
        test('scheduler.js exports runGapAnalysis method', () => {
            expect(typeof scheduler.runGapAnalysis).toBe('function');
        });

        test('schedulerService.js does NOT export runPatternAnalysis (deprecated v0.37.5)', () => {
            // runPatternAnalysis was deprecated in v0.37.5-alpha as part of Library Profile redesign
            expect(schedulerService.runPatternAnalysis).toBeUndefined();
        });

        test('scheduler.js does NOT have runPatternAnalysis', () => {
            // This should be undefined since runPatternAnalysis is on schedulerService
            expect(scheduler.runPatternAnalysis).toBeUndefined();
        });

        test('schedulerService.js does NOT have runGapAnalysis', () => {
            // This should be undefined since runGapAnalysis is on scheduler
            expect(schedulerService.runGapAnalysis).toBeUndefined();
        });
    });

    describe('EnrichmentRetryService Tavily Result Parsing', () => {
        test('extractImdbData correctly processes array of results', () => {
            const mockResults = [
                {
                    url: 'https://www.imdb.com/title/tt1234567/',
                    title: 'Test Movie (2024) - IMDb',
                    content: 'Test Movie: 8.5/10 - Action, Drama, Thriller'
                }
            ];

            const result = enrichmentRetryService.extractImdbData(mockResults, 'Test Movie');

            expect(result).not.toBeNull();
            expect(result.imdb_id).toBe('tt1234567');
            expect(result.source).toBe('tavily');
            expect(result.rating).toBe(8.5);
            expect(result.genres).toContain('Action');
            expect(result.genres).toContain('Drama');
            expect(result.genres).toContain('Thriller');
        });

        test('extractImdbData returns null for non-IMDb results', () => {
            const mockResults = [
                {
                    url: 'https://www.rottentomatoes.com/m/test_movie',
                    title: 'Test Movie',
                    content: 'Some content'
                }
            ];

            const result = enrichmentRetryService.extractImdbData(mockResults, 'Test Movie');
            expect(result).toBeNull();
        });

        test('extractImdbData handles empty results array', () => {
            const result = enrichmentRetryService.extractImdbData([], 'Test Movie');
            expect(result).toBeNull();
        });

        test('extractImdbData handles results with missing fields', () => {
            const mockResults = [
                {
                    url: 'https://www.imdb.com/title/tt9999999/',
                    title: 'Minimal Movie'
                    // No content field
                }
            ];

            const result = enrichmentRetryService.extractImdbData(mockResults, 'Minimal Movie');

            expect(result).not.toBeNull();
            expect(result.imdb_id).toBe('tt9999999');
            expect(result.rating).toBeUndefined();
            expect(result.genres).toBeUndefined();
        });
    });

    describe('MediaSync Library Existence Check', () => {
        test('mediaSync service has upsertMediaItem method', () => {
            expect(typeof mediaSync.upsertMediaItem).toBe('function');
        });

        test('mediaSync service has upsertCollection method', () => {
            expect(typeof mediaSync.upsertCollection).toBe('function');
        });
    });
});
