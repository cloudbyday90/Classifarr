/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => {
  const queryMock = jest.fn();
  return {
    query: queryMock,
    withTransaction: jest.fn(async (fn) => fn({ query: queryMock })),
  };
});

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
}));

const db = require('../config/database');
const policiesRouter = require('../routes/policies');

describe('Policies threshold routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/policies', policiesRouter);
  });

  test('POST rejects thresholds above the policy-engine ceiling', async () => {
    const res = await request(app)
      .post('/api/policies')
      .send({
        library_id: 1,
        name: 'Too High',
        auto_classify_threshold: 96,
      })
      .expect(400);

    expect(res.body.error).toContain('auto_classify_threshold');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('POST rejects inverted threshold ladders', async () => {
    const res = await request(app)
      .post('/api/policies')
      .send({
        library_id: 1,
        name: 'Inverted',
        auto_classify_threshold: 70,
        prompt_threshold: 80,
      })
      .expect(400);

    expect(res.body.error).toContain('prompt_threshold must be less than or equal to auto_classify_threshold');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('POST rejects null thresholds instead of coercing them', async () => {
    const res = await request(app)
      .post('/api/policies')
      .send({
        library_id: 1,
        name: 'Null Threshold',
        auto_classify_threshold: null,
      })
      .expect(400);

    expect(res.body.error).toContain('auto_classify_threshold');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('PUT rejects invalid threshold shapes before querying', async () => {
    const res = await request(app)
      .put('/api/policies/8')
      .send({ auto_classify_threshold: -1 })
      .expect(400);

    expect(res.body.error).toContain('auto_classify_threshold');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('PUT rejects merged threshold ladders that become inverted', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 8,
        auto_classify_threshold: 85,
        prompt_threshold: 60,
        preset_weight: 0.35,
        profile_weight: 0.25,
        pattern_weight: 0.15,
        rag_weight: 0.15,
        history_weight: 0.1,
      }]
    });

    const res = await request(app)
      .put('/api/policies/8')
      .send({ prompt_threshold: 90 })
      .expect(400);

    expect(res.body.error).toContain('prompt_threshold must be less than or equal to auto_classify_threshold');
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});
