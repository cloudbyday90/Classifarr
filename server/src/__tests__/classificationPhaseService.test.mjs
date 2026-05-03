/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockDb = { query: mockQuery };

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));
jest.unstable_mockModule('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

await import('../config/database');
const { default: classificationPhaseService } = await import('../services/classificationPhaseService.mjs');

describe('classificationPhaseService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        classificationPhaseService.webSocketService = {
            emitTaskProgress: jest.fn()
        };
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    describe('updatePhase', () => {
        it('should update phase and emit progress event for a task', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_phase: 'queued',
                    phase_started_at: new Date().toISOString(),
                    phase_history: [],
                    payload: JSON.stringify({ title: 'Test Movie' })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.updatePhase(1, 'metadata_fetch', {});

            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(result).toMatchObject({
                taskId: 1,
                phase: 'metadata_fetch',
                phaseIndex: 2
            });
            expect(classificationPhaseService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    taskId: 1,
                    phase: 'metadata_fetch',
                    phaseIndex: 2,
                    totalPhases: 8
                })
            );
        });

        it('should return null for invalid phase', async () => {
            const result = await classificationPhaseService.updatePhase(1, 'invalid_phase');
            expect(result).toBeNull();
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.updatePhase(999, 'metadata_fetch');

            expect(result).toBeNull();
        });

        it('should persist skipped phases when transition metadata includes skippedPhases', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_phase: 'rag_analysis',
                    phase_started_at: new Date().toISOString(),
                    phase_history: [],
                    payload: JSON.stringify({ title: 'Skipped Phase Test' })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.updatePhase(1, 'ai_analysis', {
                skippedPhases: ['signal_combine'],
                skippedPhaseMetadata: {
                    signal_combine: { reason: 'policy_signal_path' }
                }
            });

            const skippedEntry = result.history.find(entry => entry.phase === 'signal_combine');

            expect(result).toMatchObject({
                taskId: 1,
                phase: 'ai_analysis',
                phaseIndex: 6
            });
            expect(skippedEntry).toMatchObject({
                phase: 'signal_combine',
                status: 'skipped',
                duration_ms: 0,
                metadata: { reason: 'policy_signal_path' }
            });
        });

        it('should resolve display title from nested media payload when top-level title is missing', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_phase: 'queued',
                    phase_started_at: new Date().toISOString(),
                    phase_history: [],
                    payload: JSON.stringify({
                        media: { title: 'Nested Media Title', year: 2026, media_type: 'movie' }
                    })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationPhaseService.updatePhase(1, 'metadata_fetch', {});

            expect(classificationPhaseService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    title: 'Nested Media Title'
                })
            );
        });
    });

    describe('getProgress', () => {
        it('should return progress for a task', async () => {
            const mockTask = {
                id: 1,
                payload: JSON.stringify({ title: 'Test Movie', year: 2024, media_type: 'movie' }),
                current_phase: 'rag_analysis',
                phase_index: 4,
                phase_started_at: new Date().toISOString(),
                phase_history: [],
                status: 'processing'
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockTask] });

            const result = await classificationPhaseService.getProgress(1);

            expect(result).toMatchObject({
                taskId: 1,
                title: 'Test Movie',
                currentPhase: 'rag_analysis',
                phaseIndex: 4,
                totalPhases: 8
            });
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([1])
            );
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.getProgress(999);

            expect(result).toBeNull();
        });
    });

    describe('getActiveClassifications', () => {
        it('should return all active classifications', async () => {
            const mockTasks = [
                { id: 1, payload: { title: 'Test Movie 1' }, current_phase: 'metadata_fetch', phase_index: 2, phase_started_at: new Date().toISOString(), phase_history: [], created_at: new Date() },
                { id: 2, payload: { title: 'Test Movie 2' }, current_phase: 'rag_analysis', phase_index: 4, phase_started_at: new Date().toISOString(), phase_history: [], created_at: new Date() }
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockTasks });

            const result = await classificationPhaseService.getActiveClassifications();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ taskId: 1, title: 'Test Movie 1', currentPhase: 'metadata_fetch' });
            expect(result[1]).toMatchObject({ taskId: 2, title: 'Test Movie 2', currentPhase: 'rag_analysis' });
        });

        it('should return empty array when no active classifications', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.getActiveClassifications();

            expect(result).toEqual([]);
        });

        it('should resolve display title/year/mediaType from nested payload fields', async () => {
            const mockTasks = [
                {
                    id: 42,
                    payload: JSON.stringify({
                        media: { title: 'From Media Payload', year: '2025', media_type: 'tv' }
                    }),
                    current_phase: 'ai_analysis',
                    phase_index: 6,
                    phase_started_at: new Date().toISOString(),
                    phase_history: [],
                    created_at: new Date()
                }
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockTasks });

            const result = await classificationPhaseService.getActiveClassifications();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                taskId: 42,
                title: 'From Media Payload',
                year: 2025,
                mediaType: 'tv'
            });
        });
    });

    describe('completeTracking', () => {
        it('should complete phase tracking and clear current phase', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_phase: 'notification', phase_started_at: new Date().toISOString(), phase_history: [] }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationPhaseService.completeTracking(1, { library: 'Movies', confidence: 95 });

            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining('UPDATE task_queue'),
                expect.any(Array)
            );
            expect(classificationPhaseService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    taskId: 1,
                    phase: 'completed',
                    progress: 100,
                    completed: true
                })
            );
        });

        it('should handle non-existent task gracefully', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationPhaseService.completeTracking(999);

            expect(mockQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('resumeFromPhase', () => {
        it('should return the phase to resume from', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_phase: 'rag_analysis', phase_index: 4 }]
            });

            const result = await classificationPhaseService.resumeFromPhase(1);

            expect(result).toBe('rag_analysis');
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationPhaseService.resumeFromPhase(999);

            expect(result).toBeNull();
        });
    });

    describe('getPhaseMetadata', () => {
        it('should return phase metadata for all phases', () => {
            const metadata = classificationPhaseService.getPhaseMetadata();

            expect(metadata).toHaveLength(8);
            expect(metadata[0]).toMatchObject({ name: 'queued', index: 1 });
            expect(metadata[7]).toMatchObject({ name: 'notification', index: 8 });
        });
    });

    describe('isValidPhase', () => {
        it('should return true for valid phases', () => {
            const validPhases = ['queued', 'metadata_fetch', 'policy_eval', 'rag_analysis', 'signal_combine', 'ai_analysis', 'decision', 'notification'];

            validPhases.forEach(phase => {
                expect(classificationPhaseService.isValidPhase(phase)).toBe(true);
            });
        });

        it('should return false for invalid phases', () => {
            expect(classificationPhaseService.isValidPhase('invalid_phase')).toBe(false);
            expect(classificationPhaseService.isValidPhase('policy_evaluation')).toBe(false);
            expect(classificationPhaseService.isValidPhase('signal_combination')).toBe(false);
        });
    });

    describe('buildPhaseList', () => {
        it('should build phase list with correct statuses', () => {
            const mockTask = {
                current_phase: 'rag_analysis',
                phase_started_at: new Date().toISOString(),
                phase_history: [
                    { phase: 'queued', completed_at: new Date().toISOString() },
                    { phase: 'metadata_fetch', completed_at: new Date().toISOString() },
                    { phase: 'policy_eval', completed_at: new Date().toISOString() }
                ]
            };

            const phases = classificationPhaseService.buildPhaseList(mockTask);

            expect(phases).toHaveLength(8);
            expect(phases[0].status).toBe('complete');
            expect(phases[1].status).toBe('complete');
            expect(phases[2].status).toBe('complete');
            expect(phases[3].status).toBe('in_progress');
            expect(phases[4].status).toBe('pending');
            expect(phases[5].status).toBe('pending');
            expect(phases[6].status).toBe('pending');
            expect(phases[7].status).toBe('pending');
        });

        it('should preserve skipped phase state from history', () => {
            const mockTask = {
                current_phase: 'decision',
                phase_started_at: new Date().toISOString(),
                phase_history: [
                    { phase: 'queued', completed_at: new Date().toISOString() },
                    { phase: 'metadata_fetch', completed_at: new Date().toISOString() },
                    { phase: 'policy_eval', completed_at: new Date().toISOString() },
                    { phase: 'rag_analysis', completed_at: new Date().toISOString() },
                    { phase: 'signal_combine', status: 'skipped', completed_at: new Date().toISOString() },
                    { phase: 'ai_analysis', completed_at: new Date().toISOString() }
                ]
            };

            const phases = classificationPhaseService.buildPhaseList(mockTask);

            expect(phases[4].status).toBe('skipped');
            expect(phases[6].status).toBe('in_progress');
        });
    });

    describe('getPhaseCount', () => {
        it('should return 8 phases', () => {
            expect(classificationPhaseService.getPhaseCount()).toBe(8);
        });
    });
});
