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

const loadWeights = jest.fn();
const getWeights = jest.fn();
const getThreshold = jest.fn();
const getDefaultWeights = jest.fn();
const saveWeights = jest.fn();
const saveThreshold = jest.fn();

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => ({
  default: {
    loadWeights,
    getWeights,
    getThreshold,
    getDefaultWeights,
    saveWeights,
    saveThreshold,
  },
}));

jest.unstable_mockModule('../services/signalCollector.mjs', () => ({
  SIGNAL_TYPES: ['tmdb', 'genre', 'keyword'],
  default: {
    SIGNAL_TYPES: ['tmdb', 'genre', 'keyword'],
  },
}));

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

const { default: confidenceRouter } = await import('../routes/confidence.mjs');

describe('Confidence Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetAllMocks();
    getWeights.mockReturnValue({ tmdb: 50, genre: 25 });
    getThreshold.mockReturnValue(80);
    getDefaultWeights.mockReturnValue({ tmdb: 40, genre: 30 });

    app = express();
    app.use(express.json());
    app.use('/confidence', confidenceRouter);
  });

  it('returns weights, threshold, and defaults', async () => {
    const res = await request(app)
      .get('/confidence/weights')
      .expect(200);

    expect(loadWeights).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      weights: { tmdb: 50, genre: 25 },
      threshold: 80,
      signalTypes: ['tmdb', 'genre', 'keyword'],
      defaults: { tmdb: 40, genre: 30 },
    });
  });

  it('rejects invalid weights', async () => {
    const res = await request(app)
      .put('/confidence/weights')
      .send({ weights: { tmdb: 101 } })
      .expect(400);

    expect(res.body.error).toBe('Invalid weight for tmdb: must be a number between 0 and 100');
    expect(saveWeights).not.toHaveBeenCalled();
  });

  it('saves valid weights', async () => {
    getWeights.mockReturnValueOnce({ tmdb: 55, genre: 20 });

    const res = await request(app)
      .put('/confidence/weights')
      .send({ weights: { tmdb: 55, genre: 20 } })
      .expect(200);

    expect(saveWeights).toHaveBeenCalledWith({ tmdb: 55, genre: 20 });
    expect(res.body).toEqual({
      success: true,
      weights: { tmdb: 55, genre: 20 },
    });
  });

  it('rejects invalid threshold values', async () => {
    const res = await request(app)
      .put('/confidence/threshold')
      .send({ threshold: -1 })
      .expect(400);

    expect(res.body.error).toBe('Threshold must be a number between 0 and 100');
    expect(saveThreshold).not.toHaveBeenCalled();
  });

  it('saves threshold updates', async () => {
    getThreshold.mockReturnValueOnce(85);

    const res = await request(app)
      .put('/confidence/threshold')
      .send({ threshold: 85 })
      .expect(200);

    expect(saveThreshold).toHaveBeenCalledWith(85);
    expect(res.body).toEqual({
      success: true,
      threshold: 85,
    });
  });

  it('resets weights and threshold to defaults', async () => {
    const res = await request(app)
      .post('/confidence/reset')
      .expect(200);

    expect(saveWeights).toHaveBeenCalledWith({ tmdb: 40, genre: 30 });
    expect(saveThreshold).toHaveBeenCalledWith(80);
    expect(res.body).toEqual({
      success: true,
      weights: { tmdb: 40, genre: 30 },
      threshold: 80,
    });
  });
});
