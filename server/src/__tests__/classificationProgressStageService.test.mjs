/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const mockQuery = jest.fn();
const mockDb = { query: mockQuery };
const loggerModule = createLoggerModuleMock();

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => loggerModule.module);

await import('../config/database.mjs');
const { classificationProgressStageService } = await import('../services/classificationProgressStageService.mjs');

describe('classificationProgressStageService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        classificationProgressStageService.webSocketService = {
            emitTaskProgress: jest.fn()
        };
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    describe('updateStage', () => {
        it('should update stage and emit progress event for a task with legacy aliases', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_stage: 'queued',
                    stage_started_at: new Date().toISOString(),
                    stage_history: [],
                    payload: JSON.stringify({ title: 'Test Movie' })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.updateStage(1, 'metadata_fetch', {});

            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(result).toMatchObject({
                taskId: 1,
                stage: 'metadata_fetch',
                stageIndex: 2,
                totalStages: 8,
                stage: 'metadata_fetch',
                stageIndex: 2
            });
            expect(classificationProgressStageService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    taskId: 1,
                    stage: 'metadata_fetch',
                    stageIndex: 2,
                    totalStages: 8,
                    stage: 'metadata_fetch',
                    stageIndex: 2,
                    totalStages: 8
                })
            );
        });

        it('should return null for invalid stage', async () => {
            const result = await classificationProgressStageService.updateStage(1, 'invalid_phase');
            expect(result).toBeNull();
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.updateStage(999, 'metadata_fetch');

            expect(result).toBeNull();
        });

        it('should persist skipped stages when transition metadata includes skippedStages', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_stage: 'rag_analysis',
                    stage_started_at: new Date().toISOString(),
                    stage_history: [],
                    payload: JSON.stringify({ title: 'Skipped Stage Test' })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.updateStage(1, 'ai_analysis', {
                skippedStages: ['signal_combine'],
                skippedStageMetadata: {
                    signal_combine: { reason: 'policy_signal_path' }
                }
            });

            const skippedEntry = result.history.find(entry => entry.stage === 'signal_combine');

            expect(result).toMatchObject({
                taskId: 1,
                stage: 'ai_analysis',
                stageIndex: 6,
                totalStages: 8,
            });
            expect(skippedEntry).toMatchObject({
                stage: 'signal_combine',
                status: 'skipped',
                duration_ms: 0,
                metadata: { reason: 'policy_signal_path' }
            });
        });

        it('should resolve display title from nested media payload when top-level title is missing', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    current_stage: 'queued',
                    stage_started_at: new Date().toISOString(),
                    stage_history: [],
                    payload: JSON.stringify({
                        media: { title: 'Nested Media Title', year: 2026, media_type: 'movie' }
                    })
                }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationProgressStageService.updateStage(1, 'metadata_fetch', {});

            expect(classificationProgressStageService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
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
                current_stage: 'rag_analysis',
                stage_index: 4,
                stage_started_at: new Date().toISOString(),
                stage_history: [],
                status: 'processing'
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockTask] });

            const result = await classificationProgressStageService.getProgress(1);

            expect(result).toMatchObject({
                taskId: 1,
                title: 'Test Movie',
                currentStage: 'rag_analysis',
                stageIndex: 4,
                totalStages: 8,
                currentStage: 'rag_analysis',
                stageIndex: 4,
                totalStages: 8
            });
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([1])
            );
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.getProgress(999);

            expect(result).toBeNull();
        });

        it('logs the durable resume-stage diagnostic when the query fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('database offline'));

            const result = await classificationProgressStageService.resumeFromStage(1);

            expect(result).toBeNull();
            expect(loggerModule.logger.error).toHaveBeenCalledWith(
                'Failed to get resume stage',
                { taskId: 1, error: 'database offline' }
            );
        });
    });

    describe('getActiveClassifications', () => {
        it('should return all active classifications', async () => {
            const mockTasks = [
                { id: 1, payload: { title: 'Test Movie 1' }, current_stage: 'metadata_fetch', stage_index: 2, stage_started_at: new Date().toISOString(), stage_history: [], created_at: new Date() },
                { id: 2, payload: { title: 'Test Movie 2' }, current_stage: 'rag_analysis', stage_index: 4, stage_started_at: new Date().toISOString(), stage_history: [], created_at: new Date() }
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockTasks });

            const result = await classificationProgressStageService.getActiveClassifications();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                taskId: 1,
                title: 'Test Movie 1',
                currentStage: 'metadata_fetch',
                currentStage: 'metadata_fetch'
            });
            expect(result[1]).toMatchObject({
                taskId: 2,
                title: 'Test Movie 2',
                currentStage: 'rag_analysis',
                currentStage: 'rag_analysis'
            });
        });

        it('should return empty array when no active classifications', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.getActiveClassifications();

            expect(result).toEqual([]);
        });

        it('should resolve display title/year/mediaType from nested payload fields', async () => {
            const mockTasks = [
                {
                    id: 42,
                    payload: JSON.stringify({
                        media: { title: 'From Media Payload', year: '2025', media_type: 'tv' }
                    }),
                    current_stage: 'ai_analysis',
                    stage_index: 6,
                    stage_started_at: new Date().toISOString(),
                    stage_history: [],
                    created_at: new Date()
                }
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockTasks });

            const result = await classificationProgressStageService.getActiveClassifications();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                taskId: 42,
                title: 'From Media Payload',
                year: 2025,
                mediaType: 'tv',
                currentStage: 'ai_analysis',
                stageMetadata: expect.objectContaining({ label: 'AI Analysis' }),
                stageMetadata: expect.objectContaining({ label: 'AI Analysis' })
            });
        });
    });

    describe('completeTracking', () => {
        it('should complete stage tracking and clear current progress stage', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_stage: 'notification', stage_started_at: new Date().toISOString(), stage_history: [] }]
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationProgressStageService.completeTracking(1, { library: 'Movies', confidence: 95 });

            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(mockQuery).toHaveBeenLastCalledWith(
                expect.stringContaining('UPDATE task_queue'),
                expect.any(Array)
            );
            expect(classificationProgressStageService.webSocketService.emitTaskProgress).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    taskId: 1,
                    stage: 'completed',
                    stageIndex: 8,
                    totalStages: 8,
                    stage: 'completed',
                    stageIndex: 8,
                    totalStages: 8,
                    progress: 100,
                    completed: true
                })
            );
        });

        it('should handle non-existent task gracefully', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await classificationProgressStageService.completeTracking(999);

            expect(mockQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('resumeFromStage', () => {
        it('should return the stage to resume from', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_stage: 'rag_analysis', stage_index: 4 }]
            });

            const result = await classificationProgressStageService.resumeFromStage(1);

            expect(result).toBe('rag_analysis');
        });

        it('should return null for non-existent task', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await classificationProgressStageService.resumeFromStage(999);

            expect(result).toBeNull();
        });
    });

    describe('getStageMetadata', () => {
        it('should return stage metadata for all stages', () => {
            const metadata = classificationProgressStageService.getStageMetadata();

            expect(metadata).toHaveLength(8);
            expect(metadata[0]).toMatchObject({ name: 'queued', index: 1 });
            expect(metadata[7]).toMatchObject({ name: 'notification', index: 8 });
        });
    });

    describe('isValidStage', () => {
        it('should return true for valid stages', () => {
            const validStages = ['queued', 'metadata_fetch', 'policy_eval', 'rag_analysis', 'signal_combine', 'ai_analysis', 'decision', 'notification'];

            validStages.forEach(stage => {
                expect(classificationProgressStageService.isValidStage(stage)).toBe(true);
            });
        });

        it('should return false for invalid stages', () => {
            expect(classificationProgressStageService.isValidStage('invalid_phase')).toBe(false);
            expect(classificationProgressStageService.isValidStage('policy_evaluation')).toBe(false);
            expect(classificationProgressStageService.isValidStage('signal_combination')).toBe(false);
        });
    });

    describe('buildStageList', () => {
        it('should build stage list with correct statuses', () => {
            const mockTask = {
                current_stage: 'rag_analysis',
                stage_started_at: new Date().toISOString(),
                stage_history: [
                    { stage: 'queued', completed_at: new Date().toISOString() },
                    { stage: 'metadata_fetch', completed_at: new Date().toISOString() },
                    { stage: 'policy_eval', completed_at: new Date().toISOString() }
                ]
            };

            const stages = classificationProgressStageService.buildStageList(mockTask);

            expect(stages).toHaveLength(8);
            expect(stages[0].status).toBe('complete');
            expect(stages[1].status).toBe('complete');
            expect(stages[2].status).toBe('complete');
            expect(stages[3].status).toBe('in_progress');
            expect(stages[4].status).toBe('pending');
            expect(stages[5].status).toBe('pending');
            expect(stages[6].status).toBe('pending');
            expect(stages[7].status).toBe('pending');
        });

        it('should preserve skipped stage state from history', () => {
            const mockTask = {
                current_stage: 'decision',
                stage_started_at: new Date().toISOString(),
                stage_history: [
                    { stage: 'queued', completed_at: new Date().toISOString() },
                    { stage: 'metadata_fetch', completed_at: new Date().toISOString() },
                    { stage: 'policy_eval', completed_at: new Date().toISOString() },
                    { stage: 'rag_analysis', completed_at: new Date().toISOString() },
                    { stage: 'signal_combine', status: 'skipped', completed_at: new Date().toISOString() },
                    { stage: 'ai_analysis', completed_at: new Date().toISOString() }
                ]
            };

            const stages = classificationProgressStageService.buildStageList(mockTask);

            expect(stages[4].status).toBe('skipped');
            expect(stages[6].status).toBe('in_progress');
        });
    });

    describe('getStageCount', () => {
        it('should return 8 stages', () => {
            expect(classificationProgressStageService.getStageCount()).toBe(8);
        });
    });
});
