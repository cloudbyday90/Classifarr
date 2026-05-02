/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    RAG_ERROR_TYPES,
    RAG_SECOND_PASS_REASON_CODES,
    categorizeError,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage
} from '../utils/ragErrorHandler.mjs';

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

    test('maps pass1 candidate timeout to a specific retrieval reason code', () => {
        const error = new Error('rag_pass1_candidate_timeout');
        error.name = 'TimeoutError';

        const mapped = mapSecondPassError({
            stage: 'gate',
            fallbackReasonCode: 'rag_pass1_candidate_failed',
            error
        });

        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_TIMEOUT);
        expect(mapped.recoverable).toBe(true);
    });

    test('maps pass2 retrieval provider errors to specific reason code', () => {
        const error = new Error('Ollama provider unavailable');

        const mapped = mapSecondPassError({
            stage: 'retrieval_pass2',
            fallbackReasonCode: 'rag_pass2_failed',
            error
        });

        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_PROVIDER_FAILED);
        expect(mapped.recoverable).toBe(true);
    });

    test('maps pass2 retrieval db errors to specific reason code', () => {
        const error = new Error('database query failed');
        error.code = '57014';

        const mapped = mapSecondPassError({
            stage: 'retrieval_pass2',
            fallbackReasonCode: 'rag_pass2_failed',
            error
        });

        expect(mapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_DB_FAILED);
        expect(mapped.recoverable).toBe(true);
        expect(mapped.sqlState).toBe('57014');
    });

    test('maps pass2 retrieval embedding and abort errors to specific reason codes', () => {
        const embedError = new Error('embedding generation failed');
        const embedMapped = mapSecondPassError({
            stage: 'retrieval_pass2',
            fallbackReasonCode: 'rag_pass2_failed',
            error: embedError
        });

        const abortError = new Error('request aborted');
        abortError.name = 'AbortError';
        const abortMapped = mapSecondPassError({
            stage: 'retrieval_pass2',
            fallbackReasonCode: 'rag_pass2_failed',
            error: abortError
        });

        expect(embedMapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_EMBED_FAILED);
        expect(abortMapped.reasonCode).toBe(RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_ABORTED);
    });

    test('preserves explicit reason code instead of overriding with generic mapped fallback', () => {
        const error = new Error('any error');
        const mapped = mapSecondPassError({
            stage: 'retrieval_pass2',
            reasonCode: 'rag_pass2_provider_failed',
            fallbackReasonCode: 'rag_pass2_failed',
            error
        });

        expect(mapped.reasonCode).toBe('rag_pass2_provider_failed');
    });
});
