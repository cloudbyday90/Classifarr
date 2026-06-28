/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayExecutionSummary,
  createPolicyIntentReplayExecutionContext,
  POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE,
  POLICY_INTENT_REPLAY_OPERATIONS,
  PolicyIntentReplaySideEffectBlockedError,
  serializePolicyIntentReplayExecutionContext,
} from '../services/policyIntentReplayExecutionContext.mjs';

describe('policyIntentReplayExecutionContext', () => {
  test('creates a no-side-effect dry-run replay context', () => {
    const context = createPolicyIntentReplayExecutionContext({
      traceId: 'trace-123',
      correlationId: 'corr-456',
      startedAt: '2026-06-01T10:00:00.000Z',
    });

    expect(context).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE,
      side_effects_enabled: false,
      trace_id: 'trace-123',
      correlation_id: 'corr-456',
      started_at: '2026-06-01T10:00:00.000Z',
      capabilities: {
        classification_run: false,
        ai_calls_enabled: false,
        provider_calls_enabled: false,
        arr_writes_enabled: false,
        persistence_enabled: false,
        rag_reads_enabled: false,
        profile_reads_enabled: false,
        history_reads_enabled: false,
      },
    }));
    expect(context.blocked_operations).toContain(POLICY_INTENT_REPLAY_OPERATIONS.AI_CALL);
    expect(context.blocked_operations).toContain(POLICY_INTENT_REPLAY_OPERATIONS.ARR_WRITE);
  });

  test('blocks no-op adapters with structured replay errors', async () => {
    const context = createPolicyIntentReplayExecutionContext();

    await expect(context.adapters.ai.classify({ title: 'Mulan' }))
      .rejects
      .toMatchObject({
        name: 'PolicyIntentReplaySideEffectBlockedError',
        code: 'POLICY_INTENT_REPLAY_SIDE_EFFECT_BLOCKED',
        operation: POLICY_INTENT_REPLAY_OPERATIONS.AI_CALL,
        details: expect.objectContaining({
          reason: 'dry_run_replay_context',
          title: 'Mulan',
        }),
      });

    expect(() => context.assertOperationAllowed(POLICY_INTENT_REPLAY_OPERATIONS.PROVIDER_CALL))
      .toThrow(PolicyIntentReplaySideEffectBlockedError);
  });

  test('serializes only bounded safe correlation fields', () => {
    const context = createPolicyIntentReplayExecutionContext({
      traceId: '<script>',
      correlationId: 'valid-correlation_123',
    });
    const serialized = serializePolicyIntentReplayExecutionContext(context);

    expect(serialized.trace_id).toBeNull();
    expect(serialized.correlation_id).toBe('valid-correlation_123');
    expect(JSON.stringify(serialized)).not.toContain('<script>');
    expect(serialized.blocked_operations).toHaveLength(Object.keys(POLICY_INTENT_REPLAY_OPERATIONS).length);
  });

  test('builds scoring-safe execution summaries', () => {
    const summary = buildPolicyIntentReplayExecutionSummary(createPolicyIntentReplayExecutionContext());

    expect(summary).toEqual(expect.objectContaining({
      full_classification_run: false,
      ai_calls_enabled: false,
      provider_calls_enabled: false,
      arr_writes_enabled: false,
      persistence_enabled: false,
      execution_context: expect.objectContaining({
        mode: POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE,
        side_effects_enabled: false,
      }),
    }));
  });
});
