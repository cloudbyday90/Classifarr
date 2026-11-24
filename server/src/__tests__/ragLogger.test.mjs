/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
    ...mockDb,
    default: mockDb,
}));

const mockModuleLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => mockModuleLogger
}));

await import('../config/database.mjs');
const { RAGLogger } = await import('../utils/ragLogger.mjs');
const db = mockDb;

describe('ragLogger', () => {
    let ragLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockReset();
        ragLogger = new RAGLogger();
        db.query.mockResolvedValue({ rows: [] });
    });

    test('honors an injected rag error handler loader', async () => {
        const ragErrorHandler = {
            normalizeReasonCode: jest.fn().mockReturnValue('gate_not_met')
        };
        ragLogger.ragErrorHandler = ragErrorHandler;

        await expect(ragLogger.resolveStageSeverity({
            outcome: 'skipped',
            reasonCode: 'Gate Not Met',
            recoverable: true
        })).resolves.toBe('INFO');

        expect(ragErrorHandler.normalizeReasonCode).toHaveBeenCalledTimes(1);
    });

    test('keeps skip-by-design INFO stage events console-only', async () => {
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
        expect(db.query).not.toHaveBeenCalled();
        expect(mockModuleLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage gate skipped'),
            expect.objectContaining({
                stage: 'gate',
                reasonCode: 'gate_not_met',
                classificationId: 123
            })
        );
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

    test.each([
        ['safe numeric text', { classification_id: '2147483648' }, 2147483648],
        ['snake-case precedence', { classification_id: '9007199254740993', classificationId: 42 }, '9007199254740993'],
        ['camel-case recovery', { classification_id: '042', classificationId: '9223372036854775807' }, '9223372036854775807'],
        ['unsafe number', { classification_id: Number.MAX_SAFE_INTEGER + 1 }, null],
        ['out of range', { classificationId: '9223372036854775808' }, null],
        ['nonpositive', { classification_id: -1, classificationId: 0 }, null],
        ['malformed inputs', { classification_id: ['42'], classificationId: '42suffix' }, null],
    ])('logs a stage with the correct native History ID for %s', async (_case, ids, expected) => {
        const result = await ragLogger.logStageEvent({
            ...ids,
            stage: 'policy_recheck',
            outcome: 'error',
            reason_code: 'policy_recheck_failed',
            recoverable: true,
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).toHaveBeenCalledTimes(1);
        const params = db.query.mock.calls[0][1];
        expect(params[9]).toBe(expected);
        expect(JSON.parse(params[4])).not.toHaveProperty('classificationId');
        expect(mockModuleLogger.warn).toHaveBeenCalledWith(
            expect.any(String), expect.objectContaining({ classificationId: expected }), { skipDbPersist: true },
        );
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

    test('deduplicates repeated WARN/ERROR fingerprints across History IDs within the window', async () => {
        const event = {
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason_code: 'policy_recheck_failed',
            fallback_action: 'policy_recheck_skipped',
            recoverable: true
        };

        const first = await ragLogger.logStageEvent({ ...event, classification_id: '9007199254740992' });
        const second = await ragLogger.logStageEvent({ ...event, classification_id: '9007199254740993' });

        expect(first).toEqual({ logged: true, deduped: false });
        expect(second).toEqual({ logged: false, deduped: true });
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test.each([
        [42, { classificationId: 42 }],
        ['9007199254740993', { classificationId: '9007199254740993' }],
        ['9223372036854775808', {}],
    ])('keeps the validated History ID in legacy metadata for %s', async (id, fields) => {
        const schemaError = new Error('column "error_stage" does not exist');
        schemaError.code = '42703';

        db.query
            .mockRejectedValueOnce(schemaError)
            .mockResolvedValueOnce({ rows: [] });

        const result = await ragLogger.logStageEvent({
            classification_id: id,
            stage: 'trace',
            outcome: 'error',
            reason_code: 'trace_build_failed',
            fallback_action: 'trace_omitted'
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).toHaveBeenCalledTimes(2);
        expect(db.query.mock.calls[1][0]).toContain('(level, module, message, stack_trace, metadata, rag_operation, rag_context, duration_ms, recoverable)');
        const nativeMetadata = JSON.parse(db.query.mock.calls[0][1][4]);
        const legacyParams = db.query.mock.calls[1][1];
        expect(legacyParams).toHaveLength(9);
        expect(JSON.parse(legacyParams[4])).toEqual({ ...nativeMetadata, ...fields });
    });

    test('keeps an ordinary stage log write failure on the existing failure path', async () => {
        db.query.mockRejectedValueOnce(Object.assign(new Error('numeric value out of range'), { code: '22003' }));
        const result = await ragLogger.logStageEvent({
            classification_id: '9007199254740993',
            stage: 'trace',
            outcome: 'error',
            reason_code: 'trace_build_failed',
        });

        expect(result).toEqual({ logged: false, deduped: false });
        expect(db.query).toHaveBeenCalledTimes(1);
        expect(mockModuleLogger.warn).toHaveBeenCalledWith('Failed to log second-pass stage event', {
            stage: 'trace', reason_code: 'rag_stage_log_failed',
        });
    });

    test('uses skipDbPersist option on mirror warn/error logger lines', async () => {
        await ragLogger.logStageEvent({
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason_code: 'policy_recheck_failed',
            fallback_action: 'policy_recheck_skipped',
            recoverable: true
        });

        expect(mockModuleLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage retrieval_pass2 error'),
            expect.any(Object),
            { skipDbPersist: true }
        );
    });

    test('redacts raw error metadata and stacks from persisted stage events', async () => {
        const error = new Error('provider timeout token=fixture-secret');
        error.name = 'TimeoutError';
        error.code = 'ETIMEDOUT';

        await ragLogger.logStageEvent({
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason_code: 'rag_pass2_failed',
            recoverable: true,
            error
        });

        const params = db.query.mock.calls[0][1];
        const metadata = JSON.parse(params[4]);
        expect(params[2]).toBe('Second-pass stage retrieval_pass2 error (rag_pass2_failed)');
        expect(params[3]).toBeNull();
        expect(JSON.stringify(metadata)).not.toContain('fixture-secret');
        expect(metadata).not.toHaveProperty('raw_error_message');
        expect(metadata).not.toHaveProperty('raw_error_name');
        expect(metadata).not.toHaveProperty('raw_error_code');
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

    test('keeps informational applied second-pass success events console-only but logged', async () => {
        const result = await ragLogger.logStageEvent({
            stage: 'retrieval_pass2',
            outcome: 'applied',
            reason_code: 'hybrid',
            recoverable: true
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).not.toHaveBeenCalled();
        expect(mockModuleLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage retrieval_pass2 applied'),
            expect.objectContaining({
                stage: 'retrieval_pass2',
                reasonCode: 'hybrid'
            })
        );
    });

    test('keeps policy_recheck_resolved skips informational and out of error_log', async () => {
        const result = await ragLogger.logStageEvent({
            classification_id: 777,
            stage: 'ai_rerun',
            outcome: 'skipped',
            reason_code: 'policy_recheck_resolved',
            fallback_action: 'ai_rerun_skipped',
            recoverable: true,
            trigger: 'policy_prompt_select',
            strategy: 'hybrid'
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).not.toHaveBeenCalled();
        expect(mockModuleLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage ai_rerun skipped'),
            expect.objectContaining({
                stage: 'ai_rerun',
                reasonCode: 'policy_recheck_resolved',
                classificationId: 777
            })
        );
    });

    test('keeps strategy_selected stage events out of error_log but visible in console logs', async () => {
        const result = await ragLogger.logStageEvent({
            classification_id: 321,
            stage: 'gate',
            outcome: 'strategy_selected',
            reason_code: 'sparse_metadata',
            trigger: 'policy_prompt_select',
            strategy: 'hybrid',
            recoverable: true
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).not.toHaveBeenCalled();
        expect(mockModuleLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage gate strategy_selected'),
            expect.objectContaining({
                stage: 'gate',
                reasonCode: 'sparse_metadata',
                classificationId: 321
            })
        );
    });

    test('preserves rag_candidate as a first-class second-pass stage', async () => {
        const result = await ragLogger.logStageEvent({
            classification_id: 654,
            stage: 'rag_candidate',
            outcome: 'applied',
            reason_code: 'rag_candidate_built',
            recoverable: true
        });

        expect(result).toEqual({ logged: true, deduped: false });
        expect(db.query).not.toHaveBeenCalled();
        expect(mockModuleLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Second-pass stage rag_candidate applied'),
            expect.objectContaining({
                stage: 'rag_candidate',
                reasonCode: 'rag_candidate_built',
                classificationId: 654
            })
        );
    });
});
