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
  POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS,
  POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
  buildNativeHardLimitRuleFromStrictConstraintDescriptor,
  buildPolicyStrictConstraintDescriptorAudit,
  buildPolicyStrictConstraintDescriptor,
  buildPolicyStrictConstraintDescriptorFromNativeRule,
} from '../../services/policyStrictConstraintDescriptor.mjs';

function certificationMaximumDescriptor(overrides = {}) {
  return {
    version: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
    signal_type: 'certifications',
    operator: 'max',
    values: {
      mode: 'max',
      max: 'pg-13',
    },
    constraint_mode: 'strict',
    semantics: 'compatibility',
    ...overrides,
  };
}

describe('policyStrictConstraintDescriptor', () => {
  test('audits a canonical strict descriptor before it can advance to runtime tracing', () => {
    const audit = buildPolicyStrictConstraintDescriptorAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      descriptor: expect.objectContaining({
        signal_type: 'certifications',
        operator: 'max',
      }),
      nextStep: expect.objectContaining({
        stepId: 'runtime_metrics_trace',
      }),
    }));
  });

  test('canonicalizes a strict certification maximum and converts it to a native hard-limit rule', () => {
    const descriptorResult = buildPolicyStrictConstraintDescriptor(
      certificationMaximumDescriptor()
    );
    const ruleResult = buildNativeHardLimitRuleFromStrictConstraintDescriptor(
      certificationMaximumDescriptor()
    );

    expect(descriptorResult).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      descriptor: {
        version: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
        signal_type: 'certifications',
        operator: 'max',
        values: { mode: 'max', max: 'PG-13' },
        constraint_mode: 'strict',
        semantics: 'compatibility',
      },
    }));
    expect(ruleResult).toEqual(expect.objectContaining({
      ok: true,
      rule: expect.objectContaining({
        intent_role: 'hard_limit',
        collection: 'hard_limits',
        signal_type: 'certifications',
        operator: 'max',
        values: { mode: 'max', max: 'PG-13' },
        constraint_mode: 'strict',
        semantics: 'compatibility',
        source: 'library_rebuild',
      }),
    }));
  });

  test('preserves multi-value list and numeric range semantics from native rules', () => {
    const listResult = buildPolicyStrictConstraintDescriptorFromNativeRule({
      signal_type: 'genres',
      operator: 'require_all',
      values: {
        require_all: ['Animation', 'Family'],
        exclude: ['Horror'],
      },
      constraint_mode: 'strict',
      semantics: 'identity',
    });
    const rangeResult = buildPolicyStrictConstraintDescriptorFromNativeRule({
      signal_type: 'release_year',
      operator: 'range',
      values: { min: '1990', max: '2020' },
      constraint_mode: 'strict',
      semantics: 'compatibility',
    });

    expect(listResult).toEqual(expect.objectContaining({
      ok: true,
      descriptor: expect.objectContaining({
        operator: 'require_all',
        values: {
          require_all: ['Animation', 'Family'],
          exclude: ['Horror'],
        },
      }),
    }));
    expect(rangeResult).toEqual(expect.objectContaining({
      ok: true,
      descriptor: expect.objectContaining({
        operator: 'range',
        values: { min: 1990, max: 2020 },
      }),
    }));
  });

  test('rejects label-derived, unsupported, and internally inconsistent descriptors', () => {
    const labelDerived = buildPolicyStrictConstraintDescriptor({
      version: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
      signal_type: 'certifications',
      operator: 'max',
      values: { label: 'PG-13' },
      constraint_mode: 'strict',
      semantics: 'compatibility',
    });
    const inconsistentOperator = buildPolicyStrictConstraintDescriptor(
      certificationMaximumDescriptor({ operator: 'include' })
    );
    const unsupportedField = buildPolicyStrictConstraintDescriptor({
      ...certificationMaximumDescriptor(),
      displayLabel: 'PG-13 maximum',
    });

    expect(labelDerived.ok).toBe(false);
    expect(labelDerived.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      }),
    ]));
    expect(inconsistentOperator.ok).toBe(false);
    expect(inconsistentOperator.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INCOMPATIBLE_OPERATOR,
      }),
    ]));
    expect(unsupportedField.ok).toBe(false);
    expect(unsupportedField.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSUPPORTED_DESCRIPTOR_FIELD,
      }),
    ]));
  });
});
