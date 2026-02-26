/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../services/schedulerService', () => ({
  getAllTasks: jest.fn(),
  getTaskById: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  runNow: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const schedulerService = require('../services/schedulerService');
const schedulerRouter = require('../routes/scheduler');

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
      schedulerService.getAllTasks.mockResolvedValueOnce([
        { id: 1, name: 'Task 1', task_type: 'sync', interval_minutes: 60 },
        { id: 2, name: 'Task 2', task_type: 'backup', interval_minutes: 1440 }
      ]);

      const res = await request(app).get('/scheduler');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Task 1');
    });

    it('should handle errors', async () => {
      schedulerService.getAllTasks.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/scheduler');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('GET /scheduler/:id', () => {
    it('should return task by ID', async () => {
      schedulerService.getTaskById.mockResolvedValueOnce({
        id: 1,
        name: 'Task 1',
        task_type: 'sync',
        interval_minutes: 60
      });

      const res = await request(app).get('/scheduler/1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.name).toBe('Task 1');
    });

    it('should return 404 for non-existent task', async () => {
      schedulerService.getTaskById.mockResolvedValueOnce(null);

      const res = await request(app).get('/scheduler/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should handle errors', async () => {
      schedulerService.getTaskById.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/scheduler/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('POST /scheduler', () => {
    it('should create a new task', async () => {
      schedulerService.createTask.mockResolvedValueOnce({
        id: 1,
        name: 'New Task',
        task_type: 'sync',
        interval_minutes: 60,
        enabled: true
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
      schedulerService.createTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/scheduler')
        .send({ name: 'Task', task_type: 'sync', interval_minutes: 60 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('PUT /scheduler/:id', () => {
    it('should update a task', async () => {
      schedulerService.updateTask.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Task',
        interval_minutes: 120
      });

      const res = await request(app)
        .put('/scheduler/1')
        .send({ name: 'Updated Task', interval_minutes: 120 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Task');
    });

    it('should return 404 for non-existent task', async () => {
      schedulerService.updateTask.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/scheduler/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should handle errors', async () => {
      schedulerService.updateTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .put('/scheduler/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('DELETE /scheduler/:id', () => {
    it('should delete a task', async () => {
      schedulerService.deleteTask.mockResolvedValueOnce();

      const res = await request(app).delete('/scheduler/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle errors', async () => {
      schedulerService.deleteTask.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).delete('/scheduler/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('POST /scheduler/:id/run', () => {
    it('should run a task immediately', async () => {
      schedulerService.runNow.mockResolvedValueOnce({
        success: true,
        message: 'Task executed'
      });

      const res = await request(app).post('/scheduler/1/run');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle errors', async () => {
      schedulerService.runNow.mockRejectedValueOnce(new Error('Run failed'));

      const res = await request(app).post('/scheduler/1/run');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Run failed');
    });
  });
});
