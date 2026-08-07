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
  POLICY_MATERIAL_EXCEPTION_EFFECT_IDS,
  POLICY_MATERIAL_EXCEPTION_IDS,
  POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION,
  POLICY_MATERIAL_EXCEPTION_RISK_IDS,
  buildPolicyMaterialExceptionPresentation,
  validatePolicyMaterialExceptionPresentation,
} from '../../services/policyMaterialExceptionPresentation.mjs';

describe('policyMaterialExceptionPresentation', () => {
  test('produces an empty projection for a ready destination with no conflicts', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
      constraintDecisionModel: { controls: [] },
      routingAvailable: true,
    });

    expect(presentation).toEqual(expect.objectContaining({
      version: POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION,
      hasMaterialException: false,
      exceptions: [],
      primaryExceptionId: null,
      optionalControlsHidden: true,
    }));
    expect(presentation.validation.ok).toBe(true);
    expect(Object.values(presentation.sideEffects).every(v => v === false)).toBe(true);
  });

  test('surfaces a hard-limit conflict as the primary exception', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'blocked_by_hard_limit' },
      constraintDecisionModel: {
        controls: [{ controlId: 'hard_limit', canBlockAutomaticApplication: true }],
      },
      routingAvailable: true,
    });

    expect(presentation.hasMaterialException).toBe(true);
    expect(presentation.exceptions).toHaveLength(1);
    expect(presentation.primaryExceptionId).toBe(POLICY_MATERIAL_EXCEPTION_IDS.HARD_LIMIT_CONFLICT);
    expect(presentation.exceptions[0].effectId).toBe(POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION);
    expect(presentation.exceptions[0].resolution.ownerId).toBe('HARD_LIMIT_CONTROL');
    expect(presentation.exceptions[0].resolution.automated).toBe(false);
  });

  test('surfaces a routing gap when readiness declares needs_routing', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'needs_routing' },
      constraintDecisionModel: { controls: [] },
      routingAvailable: false,
    });

    expect(presentation.hasMaterialException).toBe(true);
    expect(presentation.primaryExceptionId).toBe(POLICY_MATERIAL_EXCEPTION_IDS.ROUTING_GAP);
    expect(presentation.exceptions[0].effectId).toBe(POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.NEEDS_ROUTING);
    expect(presentation.exceptions[0].resolution.ownerId).toBe('LIBRARY_MAPPING');
  });

  test('surfaces a review-required condition', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'needs_operator_review' },
      constraintDecisionModel: { controls: [] },
      routingAvailable: true,
    });

    expect(presentation.hasMaterialException).toBe(true);
    expect(presentation.primaryExceptionId).toBe(POLICY_MATERIAL_EXCEPTION_IDS.REVIEW_REQUIRED);
    expect(presentation.exceptions[0].effectId).toBe(POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.REQUEST_REVIEW);
  });

  test('surfaces recovery-in-progress as informational only', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'stale_profile' },
      constraintDecisionModel: { controls: [] },
      routingAvailable: true,
    });

    expect(presentation.hasMaterialException).toBe(false);
    expect(presentation.exceptions).toHaveLength(1);
    expect(presentation.exceptions[0].effectId).toBe(POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.INFORMATIONAL);
    expect(presentation.exceptions[0].resolution.automated).toBe(true);
  });

  test('hides optional controls when no material conflict exists and no values are declared', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
      constraintDecisionModel: {
        controls: [
          { controlId: 'avoid', values: [] },
          { controlId: 'review_warning', values: [] },
        ],
      },
      routingAvailable: true,
    });

    expect(presentation.optionalControlsHidden).toBe(true);
  });

  test('does not hide optional controls when the operator has declared values', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
      constraintDecisionModel: {
        controls: [
          { controlId: 'avoid', values: ['R'] },
        ],
      },
      routingAvailable: true,
    });

    expect(presentation.optionalControlsHidden).toBe(false);
  });

  test('selects the highest-priority exception when multiple conditions exist', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'blocked_by_hard_limit' },
      constraintDecisionModel: {
        controls: [{ controlId: 'hard_limit', canBlockAutomaticApplication: true }],
      },
      routingAvailable: false,
    });

    expect(presentation.exceptions.length).toBeGreaterThanOrEqual(1);
    expect(presentation.primaryExceptionId).toBe(POLICY_MATERIAL_EXCEPTION_IDS.HARD_LIMIT_CONFLICT);
  });

  test('does not surface needs_more_examples as a material exception', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'needs_more_examples' },
      constraintDecisionModel: { controls: [] },
      routingAvailable: true,
    });

    expect(presentation.hasMaterialException).toBe(false);
    expect(presentation.exceptions).toEqual([]);
  });

  test('rejects an unsupported version in validation', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
    });
    const validation = validatePolicyMaterialExceptionPresentation({
      ...presentation,
      version: 'policy.material_exception_presentation.v0',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('rejects a ready state that carries exceptions', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
    });
    const tampered = {
      ...presentation,
      exceptions: [{
        exceptionId: POLICY_MATERIAL_EXCEPTION_IDS.HARD_LIMIT_CONFLICT,
        effectId: POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION,
        summary: 'test',
        resolution: { actionId: 'test', ownerId: 'test', sectionId: null, automated: false },
      }],
    };

    const validation = validatePolicyMaterialExceptionPresentation(tampered, {
      readinessStateId: 'ready',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.READY_WITH_EXCEPTIONS,
      }),
    ]));
  });

  test('rejects a presentation that reports a performed side effect', () => {
    const presentation = buildPolicyMaterialExceptionPresentation({
      readinessState: { stateId: 'ready' },
    });
    const tampered = {
      ...presentation,
      sideEffects: { ...presentation.sideEffects, routingWritten: true },
    };

    const validation = validatePolicyMaterialExceptionPresentation(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });
});
