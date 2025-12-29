/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const router = express.Router();
const confidenceCalculator = require('../services/confidenceCalculator');
const { SIGNAL_TYPES } = require('../services/signalCollector');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ConfidenceRoutes');

/**
 * @swagger
 * /api/confidence/weights:
 *   get:
 *     summary: Get all signal weights and threshold
 */
router.get('/weights', async (req, res) => {
    try {
        await confidenceCalculator.loadWeights();

        res.json({
            weights: confidenceCalculator.getWeights(),
            threshold: confidenceCalculator.getThreshold(),
            signalTypes: SIGNAL_TYPES,
            defaults: confidenceCalculator.getDefaultWeights(),
        });
    } catch (error) {
        logger.error('Failed to get weights', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/confidence/weights:
 *   put:
 *     summary: Update signal weights
 */
router.put('/weights', async (req, res) => {
    try {
        const { weights } = req.body;

        if (!weights || typeof weights !== 'object') {
            return res.status(400).json({ error: 'Invalid weights object' });
        }

        // Validate weights are numbers between 0-100
        for (const [key, value] of Object.entries(weights)) {
            if (typeof value !== 'number' || value < 0 || value > 100) {
                return res.status(400).json({
                    error: `Invalid weight for ${key}: must be a number between 0 and 100`
                });
            }
        }

        await confidenceCalculator.saveWeights(weights);

        res.json({
            success: true,
            weights: confidenceCalculator.getWeights()
        });
    } catch (error) {
        logger.error('Failed to save weights', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/confidence/threshold:
 *   put:
 *     summary: Update confidence threshold
 */
router.put('/threshold', async (req, res) => {
    try {
        const { threshold } = req.body;

        if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
            return res.status(400).json({
                error: 'Threshold must be a number between 0 and 100'
            });
        }

        await confidenceCalculator.saveThreshold(threshold);

        res.json({
            success: true,
            threshold: confidenceCalculator.getThreshold()
        });
    } catch (error) {
        logger.error('Failed to save threshold', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/confidence/reset:
 *   post:
 *     summary: Reset weights to defaults
 */
router.post('/reset', async (req, res) => {
    try {
        const defaults = confidenceCalculator.getDefaultWeights();
        await confidenceCalculator.saveWeights(defaults);
        await confidenceCalculator.saveThreshold(80);

        res.json({
            success: true,
            weights: defaults,
            threshold: 80,
        });
    } catch (error) {
        logger.error('Failed to reset weights', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
