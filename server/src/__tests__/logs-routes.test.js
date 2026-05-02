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

jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => next()
}));

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const db = require('../config/database');

const createRateLimit = jest.fn(() => (_req, _res, next) => next());
const authenticateToken = (_req, _res, next) => next();
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

describe('logs routes', () => {
    let app;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { createLogsRouter } = await import('../routes/logsRouteShared.mjs');
        app = express();
        app.use(express.json());
        app.use('/api/logs', createLogsRouter({
            express,
            rateLimit: createRateLimit,
            db,
            authenticateToken,
            logger,
        }));
    });

    test('GET /api/logs supports expanded stage/reason/sql/classification filters', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    error_id: 'err-1',
                    level: 'WARN',
                    module: 'RAG',
                    message: 'stage degraded',
                    resolved: false,
                    created_at: new Date('2026-02-11T12:00:00.000Z'),
                    classification_id: 42,
                    error_stage: 'policy_recheck',
                    reason_code: 'db_retryable_conflict',
                    correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
                    sql_state: '40001',
                    rag_operation: 'second_pass',
                    recoverable: true
                }]
            });

        const response = await request(app)
            .get('/api/logs?resolved=false&stage=policy_recheck&reasonCode=db_retryable_conflict&sqlState=40001&classificationId=42&correlationId=95f95cb5-fce5-4d84-9ac4-5f2838f307f4')
            .expect(200);

        expect(db.query).toHaveBeenCalledTimes(2);
        expect(db.query.mock.calls[0][0]).toContain(`to_jsonb(error_log)->>'error_stage'`);
        expect(db.query.mock.calls[0][0]).toContain(`to_jsonb(error_log)->>'reason_code'`);
        expect(db.query.mock.calls[0][0]).toContain(`to_jsonb(error_log)->>'sql_state'`);
        expect(db.query.mock.calls[0][0]).toContain(`to_jsonb(error_log)->>'classification_id'`);
        expect(db.query.mock.calls[0][0]).toContain(`to_jsonb(error_log)->>'correlation_id'`);
        expect(db.query.mock.calls[1][0]).toContain('classification_id');
        expect(db.query.mock.calls[1][0]).toContain(`COALESCE((to_jsonb(error_log)->>'reason_code'), metadata->>'reasonCode') AS reason_code`);
        expect(db.query.mock.calls[1][0]).toContain(`COALESCE((to_jsonb(error_log)->>'correlation_id'), metadata->>'correlationId') AS correlation_id`);
        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].error_stage).toBe('policy_recheck');
        expect(response.body.logs[0].reason_code).toBe('db_retryable_conflict');
    });

    test('GET /api/logs supports retry audit filter in existing logs surface', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 9,
                    error_id: 'err-9',
                    level: 'INFO',
                    module: 'ClassificationRetryService',
                    message: 'Classification retry queued',
                    resolved: false,
                    created_at: new Date('2026-02-26T12:00:00.000Z'),
                    classification_id: null,
                    error_stage: null,
                    reason_code: 'queued',
                    correlation_id: 'corr-9',
                    sql_state: null,
                    rag_operation: null,
                    recoverable: null,
                    actor: 'admin',
                    result: 'queued',
                    route: '/api/classification/retry'
                }]
            });

        const response = await request(app)
            .get('/api/logs?audit=classification_retry')
            .expect(200);

        expect(db.query).toHaveBeenCalledTimes(2);
        expect(db.query.mock.calls[0][0]).toContain('module = $');
        expect(db.query.mock.calls[0][0]).toContain('message ILIKE $');
        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].module).toBe('ClassificationRetryService');
    });

    test('GET /api/logs remains backward-compatible without expanded filters', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ total: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 8,
                    error_id: 'err-2',
                    level: 'ERROR',
                    module: 'classification',
                    message: 'baseline failure',
                    resolved: false,
                    created_at: new Date('2026-02-11T12:30:00.000Z'),
                    classification_id: null,
                    error_stage: null,
                    reason_code: null,
                    correlation_id: null,
                    sql_state: null,
                    rag_operation: null,
                    recoverable: null
                }]
            });

        const response = await request(app)
            .get('/api/logs?page=1&limit=10')
            .expect(200);

        expect(response.body.logs).toHaveLength(1);
        expect(response.body.pagination.total).toBe(1);
        expect(response.body.logs[0].message).toBe('baseline failure');
    });

    test('GET /api/logs/export supports expanded observability filters', async () => {
        db.query.mockResolvedValue({
            rows: [{ error_id: 'err-3', error_stage: 'trace', reason_code: 'trace_build_failed' }]
        });

        await request(app)
            .get('/api/logs/export?stage=trace&reason_code=trace_build_failed&classificationId=42&sqlState=42P01')
            .expect(200);

        expect(db.query).toHaveBeenCalledTimes(1);
        const query = db.query.mock.calls[0][0];
        const params = db.query.mock.calls[0][1];
        expect(query).toContain(`to_jsonb(error_log)->>'error_stage'`);
        expect(query).toContain(`to_jsonb(error_log)->>'reason_code'`);
        expect(query).toContain(`to_jsonb(error_log)->>'classification_id'`);
        expect(query).toContain(`to_jsonb(error_log)->>'sql_state'`);
        expect(params).toContain('42P01');
    });

    test('GET /api/logs/export supports retry audit filter', async () => {
        db.query.mockResolvedValue({ rows: [{ error_id: 'err-audit' }] });

        await request(app)
            .get('/api/logs/export?audit=classification_retry')
            .expect(200);

        expect(db.query).toHaveBeenCalledTimes(1);
        const query = db.query.mock.calls[0][0];
        const params = db.query.mock.calls[0][1];
        expect(query).toContain('module = $');
        expect(query).toContain('message ILIKE $');
        expect(params).toContain('ClassificationRetryService');
    });
});
