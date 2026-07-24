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
  MOVIE_CERTIFICATION_ORDER,
  TV_CERTIFICATION_ORDER,
} from '../../services/policyEngineUtils.mjs';
import {
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION,
  buildPolicyConstraintValueEligibility,
  buildPolicyConstraintValueEligibilityAudit,
  isPolicyConstraintValueEligible,
} from '../../services/policyConstraintValueEligibility.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionsFor(projection, controlId) {
  return projection.controls.find(control => control.controlId === controlId)?.options || [];
}

describe('policyConstraintValueEligibility', () => {
  test('publishes only the canonical movie certification and review-warning values', () => {
    const projection = buildPolicyConstraintValueEligibility({
      library: { media_type: 'movie' },
    });

    expect(projection).toEqual(expect.objectContaining({
      version: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION,
      statusId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.READY,
      libraryMediaTypeFamilyId: 'movie',
      authority: {
        displayProjection: true,
        serverOwnedAllowlist: true,
        policyPersistence: false,
        routingExecution: false,
        runtimeDecision: false,
        clientMayAddValues: false,
      },
      rawPayloadExposed: false,
    }));
    expect(optionsFor(projection, 'hard_limit').map(option => option.value))
      .toEqual(MOVIE_CERTIFICATION_ORDER);
    expect(optionsFor(projection, 'avoid').map(option => option.value))
      .toEqual(MOVIE_CERTIFICATION_ORDER);
    expect(optionsFor(projection, 'review_warning').map(option => option.value)).toEqual([
      'evidence_missing',
      'evidence_conflicting',
      'profile_stale',
      'routing_not_ready',
    ]);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(buildPolicyConstraintValueEligibilityAudit(projection, {
      library: { media_type: 'movie' },
    })).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('uses television certification ordering only for television library types', () => {
    const projection = buildPolicyConstraintValueEligibility({
      library: { mediaType: 'show' },
    });

    expect(projection.libraryMediaTypeFamilyId).toBe('television');
    expect(optionsFor(projection, 'hard_limit').map(option => option.value))
      .toEqual(TV_CERTIFICATION_ORDER);
    expect(isPolicyConstraintValueEligible({
      projection,
      controlId: 'avoid',
      value: 'TV-14',
    })).toBe(true);
    expect(isPolicyConstraintValueEligible({
      projection,
      controlId: 'avoid',
      value: 'PG-13',
    })).toBe(false);
  });

  test('fails closed without controls when the library media type is not supported', () => {
    const projection = buildPolicyConstraintValueEligibility({
      library: { media_type: 'music' },
    });

    expect(projection).toEqual(expect.objectContaining({
      statusId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.UNSUPPORTED_LIBRARY_MEDIA_TYPE,
      libraryMediaTypeFamilyId: null,
      controls: [],
    }));
    expect(isPolicyConstraintValueEligible({
      projection,
      controlId: 'hard_limit',
      value: 'PG',
    })).toBe(false);
  });

  test('detects tampered option values, free text, and mismatched media families', () => {
    const projection = clone(buildPolicyConstraintValueEligibility({
      library: { media_type: 'movie' },
    }));
    projection.libraryMediaTypeFamilyId = 'television';
    projection.controls[0].allowsFreeText = true;
    projection.controls[0].options[0].value = 'Unrated';

    const audit = buildPolicyConstraintValueEligibilityAudit(projection, {
      library: { media_type: 'movie' },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_MEDIA_TYPE_FAMILY,
      }),
      expect.objectContaining({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_CONTROL_SHAPE,
        controlId: 'hard_limit',
      }),
      expect.objectContaining({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_OPTION_SHAPE,
        controlId: 'hard_limit',
      }),
    ]));
  });
});
