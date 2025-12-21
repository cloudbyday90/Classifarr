/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Scheduled tasks API routes
 */

const express = require('express');
const router = express.Router();
const schedulerService = require('../services/schedulerService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SchedulerRoutes');

/**
 * @swagger
 * /api/scheduler:
 *   get:
 *     summary: Get all scheduled tasks
 */
router.get('/', async (req, res) => {
    try {
        const tasks = await schedulerService.getAllTasks();
        res.json(tasks);
    } catch (error) {
        logger.error('Failed to get tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/scheduler/{id}:
 *   get:
 *     summary: Get a scheduled task by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const task = await schedulerService.getTaskById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        logger.error('Failed to get task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/scheduler:
 *   post:
 *     summary: Create a new scheduled task
 */
router.post('/', async (req, res) => {
    try {
        const { name, task_type, library_id, interval_minutes, enabled } = req.body;

        if (!name || !task_type) {
            return res.status(400).json({ error: 'name and task_type are required' });
        }

        if (!interval_minutes || interval_minutes < 5) {
            return res.status(400).json({ error: 'interval_minutes must be at least 5' });
        }

        const task = await schedulerService.createTask({
            name,
            task_type,
            library_id,
            interval_minutes,
            enabled
        });

        res.status(201).json(task);
    } catch (error) {
        logger.error('Failed to create task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/scheduler/{id}:
 *   put:
 *     summary: Update a scheduled task
 */
router.put('/:id', async (req, res) => {
    try {
        const task = await schedulerService.updateTask(req.params.id, req.body);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        logger.error('Failed to update task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/scheduler/{id}:
 *   delete:
 *     summary: Delete a scheduled task
 */
router.delete('/:id', async (req, res) => {
    try {
        await schedulerService.deleteTask(req.params.id);
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/scheduler/{id}/run:
 *   post:
 *     summary: Run a scheduled task immediately
 */
router.post('/:id/run', async (req, res) => {
    try {
        const result = await schedulerService.runNow(req.params.id);
        res.json(result);
    } catch (error) {
        logger.error('Failed to run task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
