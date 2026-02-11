/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const {
    RAG_ERROR_TYPES,
    RAG_SECOND_PASS_REASON_CODES,
    categorizeError,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage
} = require('../utils/ragErrorHandler');

describe('ragErrorHandler', () => {
    test('normalizes reason codes and stage values deterministically', () => {
        expect(normalizeReasonCode('  Policy Recheck Failed  ')).toBe('policy_recheck_failed');
        expect(normalizeSecondPassStage(' POLICY_RECHECK ')).toBe('policy_recheck');
        expect(normalizeSecondPassStage('unsupported_stage')).toBeNull();
    });

    test('maps SQLSTATE retryable conflicts to deterministic reason and recoverability', () => {
        const error = new Error('serialization failure');
        error.code = '40001';

        const mapped = mapSecondPassError({
            stage: 'policy_recheck',
            fallbackReasonCode: 'policy_recheck_failed',
            error
        });

        expect(mapped.errorType).toBe(RAG_ERROR_TYPES.SECOND_PASS_POLICY_RECHECK);
        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.DB_RETRYABLE_CONFLICT);
        expect(mapped.sqlState).toBe('40001');
        expect(mapped.recoverable).toBe(true);
    });

    test('maps integrity violations to non-recoverable deterministic reason', () => {
        const error = new Error('duplicate key');
        error.code = '23505';

        const mapped = mapSecondPassError({
            stage: 'policy_recheck',
            fallbackReasonCode: 'policy_recheck_failed',
            error
        });

        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.DB_INTEGRITY_VIOLATION);
        expect(mapped.recoverable).toBe(false);
    });

    test('falls back to stage default reason when no explicit reason is provided', () => {
        const mapped = mapSecondPassError({
            stage: 'trace',
            error: new Error('unexpected trace error')
        });

        expect(mapped.errorType).toBe(RAG_ERROR_TYPES.SECOND_PASS_TRACE);
        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.TRACE_BUILD_FAILED);
        expect(mapped.sqlState).toBeNull();
    });

    test('categorizes second-pass stage hints from error messages', () => {
        expect(categorizeError(new Error('Policy recheck timeout'))).toBe(
            RAG_ERROR_TYPES.SECOND_PASS_POLICY_RECHECK
        );
        expect(categorizeError(new Error('Second pass retrieval failed'))).toBe(
            RAG_ERROR_TYPES.SECOND_PASS_RETRIEVAL_PASS2
        );
    });
});

