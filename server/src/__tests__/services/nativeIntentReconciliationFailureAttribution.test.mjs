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
  NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS,
  buildNativeIntentReconciliationFailureAttribution,
  runNativeIntentReconciliationStage,
} from '../../services/nativeIntentReconciliationFailureAttribution.mjs';

describe('nativeIntentReconciliationFailureAttribution', () => {
  test('keeps a stable schema category and stage without exposing error text', async () => {
    const failure = new Error('password=do-not-store host=internal.example');
    failure.code = '42P01';

    await expect(runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_INPUT_LOAD,
      execute: async () => { throw failure; },
    })).rejects.toMatchObject({
      name: 'NativeIntentReconciliationExecutionStageError',
      code: '42P01',
      nativeIntentReconciliationFailureStageId: 'candidate_input_load',
    });

    let attributedError;
    try {
      await runNativeIntentReconciliationStage({
        stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_INPUT_LOAD,
        execute: async () => { throw failure; },
      });
    } catch (error) {
      attributedError = error;
    }

    const attribution = buildNativeIntentReconciliationFailureAttribution(attributedError);

    expect(attribution).toEqual({
      stageId: 'candidate_input_load',
      reasonId: 'reconciliation_candidate_input_load_failed',
      categoryId: 'schema_incompatible',
      systemFailureCategory: 'schema_incompatible',
      rawPayloadExposed: false,
    });
    expect(JSON.stringify(attribution)).not.toContain('password');
    expect(attributedError.message).toBe('Native intent reconciliation execution stage failed');
  });

  test('keeps an unclassified error bounded at the orchestration stage', () => {
    const attribution = buildNativeIntentReconciliationFailureAttribution(
      new Error('api_key=do-not-store'),
    );

    expect(attribution).toEqual({
      stageId: 'execution_orchestration',
      reasonId: 'reconciliation_execution_orchestration_failed',
      categoryId: 'unexpected_execution_failure',
      systemFailureCategory: null,
      rawPayloadExposed: false,
    });
    expect(JSON.stringify(attribution)).not.toContain('api_key');
  });
});
