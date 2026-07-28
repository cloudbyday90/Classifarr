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
  classifyPolicyProfileRefreshFailure,
  createPolicyProfileRefreshConfigurationError,
  evaluatePolicyNativeProfileRefreshTerminalFailure,
} from '../../services/policyProfileRefreshFailureClassification.mjs';

describe('policyProfileRefreshFailureClassification', () => {
  test('classifies only fixed server-owned configuration errors as non-retryable', () => {
    const classification = classifyPolicyProfileRefreshFailure(
      createPolicyProfileRefreshConfigurationError({ methodName: 'a profile generator' }),
    );

    expect(classification).toMatchObject({
      classId: 'permanent_configuration',
      failureCode: 'profile_refresh_configuration_invalid',
      retryable: false,
    });
  });

  test('classifies bounded dependency failures without persisting error text', () => {
    const timeout = Object.assign(new Error('private upstream detail'), { code: 'ETIMEDOUT' });

    expect(classifyPolicyProfileRefreshFailure(timeout)).toMatchObject({
      classId: 'transient_dependency',
      failureCode: 'profile_refresh_transient_dependency_failed',
      retryable: true,
    });
  });

  test('treats unrecognized failures as retryable unknowns until the circuit policy evaluates history', () => {
    expect(classifyPolicyProfileRefreshFailure(new Error('implementation detail'))).toMatchObject({
      classId: 'unknown',
      failureCode: 'profile_refresh_unknown_failed',
      retryable: true,
    });
  });

  test('blocks native successors only for fixed permanent or unrecognized persisted codes', () => {
    expect(evaluatePolicyNativeProfileRefreshTerminalFailure({
      failureCode: 'profile_refresh_configuration_invalid',
    })).toMatchObject({
      actionId: 'block_successor',
      scheduleSuccessor: false,
      reasonCodes: ['terminal_failure_configuration_invalid'],
    });
    expect(evaluatePolicyNativeProfileRefreshTerminalFailure({
      failureCode: 'profile_refresh_execution_failed',
    })).toMatchObject({
      actionId: 'schedule_successor',
      scheduleSuccessor: true,
    });
    expect(evaluatePolicyNativeProfileRefreshTerminalFailure({
      failureCode: 'untrusted_failure_code',
    })).toMatchObject({
      actionId: 'block_successor',
      scheduleSuccessor: false,
      reasonCodes: ['terminal_failure_code_unrecognized'],
    });
  });
});
