/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const classificationPhaseService = require('../services/classificationPhaseService');
const db = require('../config/database');

// Mock database
jest.mock('../config/database');

describe('classificationPhaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe('updatePhase', () => {
    it('should update phase and progress for a task', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{ progress: 50 }]
      });
      db.query = mockQuery;

      const mockEmit = jest.fn();
      classificationPhaseService.webSocketService = { emit: mockEmit };

      await classificationPhaseService.updatePhase(1, 'metadata_fetch', 'Test Item');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_queue'),
        expect.any(Array)
      );
      expect(mockEmit).toHaveBeenCalledWith('classification:progress', {
        taskId: 1,
        phase: 'metadata_fetch',
        progress: 50,
        title: 'Test Item'
      });
    });

    it('should calculate progress based on phase order', async () => {
      const phases = ['queued', 'metadata_fetch', 'policy_evaluation', 'rag_analysis', 'signal_combination', 'decision', 'notification'];
      
      for (let i = 0; i < phases.length; i++) {
        const expectedProgress = Math.round((i / (phases.length - 1)) * 100);
        const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
        db.query = mockQuery;
        const mockEmit = jest.fn();
        classificationPhaseService.webSocketService = { emit: mockEmit };

        await classificationPhaseService.updatePhase(1, phases[i]);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE task_queue'),
          expect.arrayContaining([expectedProgress])
        );
      }
    });
  });

  describe('getProgress', () => {
    it('should return progress for a task', async () => {
      const mockProgress = {
        id: 1,
        current_phase: 'rag_analysis',
        progress: 57,
        phase_history: [
          { phase: 'queued', timestamp: new Date().toISOString() },
          { phase: 'metadata_fetch', timestamp: new Date().toISOString() },
          { phase: 'policy_evaluation', timestamp: new Date().toISOString() },
          { phase: 'rag_analysis', timestamp: new Date().toISOString() }
        ]
      };
      const mockQuery = jest.fn().mockResolvedValue({ rows: [mockProgress] });
      db.query = mockQuery;

      const result = await classificationPhaseService.getProgress(1);

      expect(result).toEqual(mockProgress);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([1])
      );
    });

    it('should return null for non-existent task', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      const result = await classificationPhaseService.getProgress(999);

      expect(result).toBeNull();
    });
  });

  describe('getActiveClassifications', () => {
    it('should return all active classifications', async () => {
      const mockClassifications = [
        { id: 1, current_phase: 'metadata_fetch', progress: 28, title: 'Test Movie 1' },
        { id: 2, current_phase: 'rag_analysis', progress: 57, title: 'Test Movie 2' },
        { id: 3, current_phase: 'decision', progress: 85, title: 'Test Movie 3' }
      ];
      const mockQuery = jest.fn().mockResolvedValue({ rows: mockClassifications });
      db.query = mockQuery;

      const result = await classificationPhaseService.getActiveClassifications();

      expect(result).toEqual(mockClassifications);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
    });

    it('should return empty array when no active classifications', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      const result = await classificationPhaseService.getActiveClassifications();

      expect(result).toEqual([]);
    });
  });

  describe('completeTracking', () => {
    it('should mark task as completed and emit event', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;
      const mockEmit = jest.fn();
      classificationPhaseService.webSocketService = { emit: mockEmit };

      await classificationPhaseService.completeTracking(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_queue'),
        expect.arrayContaining([100, 'completed'])
      );
      expect(mockEmit).toHaveBeenCalledWith('classification:complete', {
        taskId: 1,
        phase: 'completed',
        progress: 100
      });
    });
  });

  describe('resumeFromPhase', () => {
    it('should resume task from specified phase', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;
      const mockEmit = jest.fn();
      classificationPhaseService.webSocketService = { emit: mockEmit };

      await classificationPhaseService.resumeFromPhase(1, 'rag_analysis');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_queue'),
        expect.arrayContaining(['rag_analysis'])
      );
      expect(mockEmit).toHaveBeenCalledWith('classification:progress', {
        taskId: 1,
        phase: 'rag_analysis',
        progress: 57 // Expected progress for rag_analysis phase
      });
    });
  });

  describe('phase calculation', () => {
    it('should calculate correct progress percentage for each phase', () => {
      const phaseProgress = {
        queued: 0,
        metadata_fetch: 16,
        policy_evaluation: 33,
        rag_analysis: 50,
        signal_combination: 66,
        decision: 83,
        notification: 100
      };

      const phases = ['queued', 'metadata_fetch', 'policy_evaluation', 'rag_analysis', 'signal_combination', 'decision', 'notification'];
      
      phases.forEach((phase, index) => {
        expect(classificationPhaseService.calculateProgress(phase)).toBe(phaseProgress[phase]);
      });
    });
  });
});
