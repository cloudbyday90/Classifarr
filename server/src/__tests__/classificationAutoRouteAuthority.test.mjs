/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ClassificationService } from '../services/classificationServiceCore.mjs';

describe('ClassificationService auto-route authority boundary', () => {
  test('blocks automatic routing for an AI-derived candidate', () => {
    const decision = ClassificationService.prototype.buildAutoRouteDecision({
      result: {
        library: { id: 1, name: 'Movies' },
        confidence: 99,
        method: 'ai_analysis',
        ai_authority: {
          sideEffects: { canRoute: false },
        },
      },
      policyAutoThreshold: 85,
    });

    expect(decision).toEqual({
      shouldRoute: false,
      reason: 'ai_authority_advisory',
    });
  });

  test('fails closed when an AI-derived candidate loses authority metadata', () => {
    const decision = ClassificationService.prototype.buildAutoRouteDecision({
      result: {
        library: { id: 1, name: 'Movies' },
        confidence: 99,
        method: 'ai_verified',
      },
      policyAutoThreshold: 85,
    });

    expect(decision).toEqual({
      shouldRoute: false,
      reason: 'ai_authority_advisory',
    });
  });

  test('preserves deterministic native policy routing', () => {
    const decision = ClassificationService.prototype.buildAutoRouteDecision({
      result: {
        library: { id: 1, name: 'Movies' },
        confidence: 99,
        method: 'policy_auto',
        ai_authority: {
          sideEffects: { canRoute: false },
        },
      },
      policyAutoThreshold: 85,
    });

    expect(decision).toEqual({
      shouldRoute: true,
      reason: 'policy_auto',
    });
  });
});
