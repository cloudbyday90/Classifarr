/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

const mockModuleLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: () => mockModuleLogger
}));

const db = require('../config/database');
const { RAGLogger } = require('../utils/ragLogger');

describe('ragLogger', () => {
    let ragLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        ragLogger = new RAGLogger();
        db.query.mockResolvedValue({ rows: [] });
    });

    test('writes structured stage events with INFO level for skip-by-design', async () => {
        const result = await ragLogger.logStageEvent({
            classification_id: 123,
            tmdb_id: 456,
            media_type: 'movie',
            stage: 'gate',
            outcome: 'skipped',
            reason_code: 'gate_not_met',
            fallback_action: 'gate_skipped',
            recoverable: true,
            rollout_mode: 'shadow',
            strategy: 'auto'
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).toHaveBeenCalledTimes(1);
        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe('INFO');
        expect(params[9]).toBe(123);
        expect(params[10]).toBe('gate');
        expect(params[11]).toBe('gate_not_met');
    });

    test('uses WARN level for recoverable degradation events', async () => {
        await ragLogger.logStageEvent({
            stage: 'policy_recheck',
            outcome: 'error',
            reason_code: 'policy_recheck_failed',
            fallback_action: 'policy_recheck_skipped',
            recoverable: true,
            sql_state: '40001'
        });

        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe('WARN');
        expect(params[10]).toBe('policy_recheck');
        expect(params[13]).toBe('40001');
    });

    test('uses ERROR level for non-recoverable actionable failures', async () => {
        await ragLogger.logStageEvent({
            stage: 'policy_recheck',
            outcome: 'error',
            reason_code: 'db_schema_mismatch',
            fallback_action: 'policy_recheck_skipped',
            recoverable: false,
            sql_state: '42P01'
        });

        const params = db.query.mock.calls[0][1];
        expect(params[0]).toBe('ERROR');
        expect(params[13]).toBe('42P01');
    });

    test('deduplicates repeated WARN/ERROR fingerprints within dedupe window', async () => {
        const event = {
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason_code: 'rag_pass2_failed',
            fallback_action: 'pass2_skipped',
            recoverable: true
        };

        const first = await ragLogger.logStageEvent(event);
        const second = await ragLogger.logStageEvent(event);

        expect(first).toEqual({ logged: true, deduped: false });
        expect(second).toEqual({ logged: false, deduped: true });
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('falls back to legacy insert when expanded columns are unavailable', async () => {
        const schemaError = new Error('column "error_stage" does not exist');
        schemaError.code = '42703';

        db.query
            .mockRejectedValueOnce(schemaError)
            .mockResolvedValueOnce({ rows: [] });

        const result = await ragLogger.logStageEvent({
            stage: 'trace',
            outcome: 'error',
            reason_code: 'trace_build_failed',
            fallback_action: 'trace_omitted'
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).toHaveBeenCalledTimes(2);
        expect(db.query.mock.calls[1][0]).toContain('(level, module, message, stack_trace, metadata, rag_operation, rag_context, duration_ms, recoverable)');
    });

    test('uses skipDbPersist option on mirror warn/error logger lines', async () => {
        await ragLogger.logStageEvent({
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason_code: 'rag_pass2_failed',
            fallback_action: 'pass2_skipped',
            recoverable: true
        });

        expect(mockModuleLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage retrieval_pass2 error'),
            expect.any(Object),
            { skipDbPersist: true }
        );
    });

    test('suppresses non-actionable second-pass no-op events', async () => {
        const result = await ragLogger.logStageEvent({
            stage: 'policy_recheck',
            outcome: 'evaluated',
            reason_code: 'policy_not_upgraded',
            recoverable: true
        });

        expect(result).toEqual({ logged: false, deduped: false, suppressed: true });
        expect(db.query).not.toHaveBeenCalled();
    });
});
