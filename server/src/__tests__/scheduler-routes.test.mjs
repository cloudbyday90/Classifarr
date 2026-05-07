/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const getAllTasks = jest.fn();
const getTaskById = jest.fn();
const createTask = jest.fn();
const updateTask = jest.fn();
const deleteTask = jest.fn();
const runNow = jest.fn();

jest.unstable_mockModule('../services/schedulerService.mjs', () => ({ schedulerService: {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    runNow,
  }, default: {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    runNow,
  }, }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
  default: {
    createLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

const { router: schedulerRouter } = await import('../routes/scheduler.mjs');

describe('Scheduler Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/scheduler', schedulerRouter);
  });

  describe('GET /scheduler', () => {
    it('should return all tasks', async () => {
      getAllTasks.mockResolvedValueOnce([
        { id: 1, name: 'Task 1', task_type: 'sync', interval_minutes: 60 },
        { id: 2, name: 'Task 2', task_type: 'backup', interval_minutes: 1440 },
      ]);

      const res = await request(app).get('/scheduler');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Task 1');
    });

    it('should handle errors', async () => {
      getAllTasks.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/scheduler');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('GET /scheduler/:id', () => {
    it('should return task by ID', async () => {
      getTaskById.mockResolvedValueOnce({
        id: 1,
        name: 'Task 1',
        task_type: 'sync',
        interval_minutes: 60,
      });

      const res = await request(app).get('/scheduler/1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.name).toBe('Task 1');
    });

    it('should return 404 for non-existent task', async () => {
      getTaskById.mockResolvedValueOnce(null);

      const res = await request(app).get('/scheduler/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should handle errors', async () => {
      getTaskById.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/scheduler/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('POST /scheduler', () => {
    it('should create a new task', async () => {
      createTask.mockResolvedValueOnce({
        id: 1,
        name: 'New Task',
        task_type: 'sync',
        interval_minutes: 60,
        enabled: true,
      });

      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'New Task', task_type: 'sync', interval_minutes: 60 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Task');
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/scheduler')
        .send({ task_type: 'sync', interval_minutes: 60 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name and task_type are required');
    });

    it('should return 400 when task_type is missing', async () => {
      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'Task', interval_minutes: 60 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name and task_type are required');
    });

    it('should return 400 when interval_minutes is missing', async () => {
      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'Task', task_type: 'sync' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('interval_minutes must be at least 5');
    });

    it('should return 400 when interval_minutes is less than 5', async () => {
      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'Task', task_type: 'sync', interval_minutes: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('interval_minutes must be at least 5');
    });

    it('should handle errors', async () => {
      createTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'Task', task_type: 'sync', interval_minutes: 60 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('PUT /scheduler/:id', () => {
    it('should update a task', async () => {
      updateTask.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Task',
        interval_minutes: 120,
      });

      const res = await request(app)
        .put('/scheduler/1')
        .send({ name: 'Updated Task', interval_minutes: 120 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Task');
    });

    it('should return 404 for non-existent task', async () => {
      updateTask.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/scheduler/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should handle errors', async () => {
      updateTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .put('/scheduler/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('DELETE /scheduler/:id', () => {
    it('should delete a task', async () => {
      deleteTask.mockResolvedValueOnce();

      const res = await request(app).delete('/scheduler/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle errors', async () => {
      deleteTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).delete('/scheduler/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('POST /scheduler/:id/run', () => {
    it('should run a task immediately', async () => {
      runNow.mockResolvedValueOnce({
        success: true,
        message: 'Task executed',
      });

      const res = await request(app).post('/scheduler/1/run');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle errors', async () => {
      runNow.mockRejectedValueOnce(new Error('Run failed'));

      const res = await request(app).post('/scheduler/1/run');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Run failed');
    });
  });
});
