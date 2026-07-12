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
  MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH,
  POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS,
  buildPolicyEvidenceEntryAudit,
  normalizePolicyEvidenceEntry,
} from '../../services/policyEvidenceEntryNormalizer.mjs';

describe('policyEvidenceEntryNormalizer', () => {
  test('normalizes bounded Unicode-safe evidence fields and source-owned reason codes', () => {
    const entry = normalizePolicyEvidenceEntry({
      key: 'Genre: Animated Movies',
      label: ' Animación\r\n',
      value: ' Family\t',
      count: 2.9,
      confidence: 86,
      reasonCode: 'untrusted caller reason',
      observedAt: '2026-07-11T12:00:00-04:00',
      stale: false,
    }, {
      defaultReasonCode: 'observed_library_profile',
    });

    expect(entry).toEqual({
      key: 'genre:animated_movies',
      label: 'Animación',
      value: 'Family',
      count: 2,
      confidence: 0.86,
      reasonCode: 'observed_library_profile',
      observedAt: '2026-07-11T16:00:00.000Z',
      stale: false,
    });
    expect(buildPolicyEvidenceEntryAudit(entry)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('drops entries with no bounded label and excludes object-valued fields', () => {
    expect(normalizePolicyEvidenceEntry({
      key: { providerPayload: { apiKey: 'must-not-project' } },
      label: { raw: true },
    })).toBeNull();

    const entry = normalizePolicyEvidenceEntry({
      label: 'Safe label',
      value: { providerPayload: { apiKey: 'must-not-project' } },
      reasonCode: 'not a canonical reason',
      observedAt: 'not-a-timestamp',
    });

    expect(entry).toEqual(expect.objectContaining({
      label: 'Safe label',
      value: null,
      reasonCode: null,
      observedAt: null,
    }));
    expect(JSON.stringify(entry)).not.toContain('must-not-project');
  });

  test('preserves absent count and confidence as null instead of inventing zero-valued evidence', () => {
    expect(normalizePolicyEvidenceEntry({
      label: 'Observed without numeric evidence',
    })).toEqual(expect.objectContaining({
      count: null,
      confidence: null,
    }));
  });

  test('retains only source-allow-listed incoming reason codes', () => {
    expect(normalizePolicyEvidenceEntry({
      label: 'Persisted outcome',
      reasonCode: 'persisted_final_outcome',
    }, {
      defaultReasonCode: 'final_outcome_observed',
      allowedReasonCodes: ['persisted_final_outcome'],
    }).reasonCode).toBe('persisted_final_outcome');

    expect(normalizePolicyEvidenceEntry({
      label: 'Tampered outcome',
      reasonCode: 'direct_learning_authorized',
    }, {
      defaultReasonCode: 'final_outcome_observed',
      allowedReasonCodes: ['persisted_final_outcome'],
    }).reasonCode).toBe('final_outcome_observed');
  });

  test('audits tampered entries with unbounded or unsafe projected fields', () => {
    const audit = buildPolicyEvidenceEntryAudit({
      key: 'invalid key',
      label: `Unsafe\n${'a'.repeat(MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH + 1)}`,
      value: { raw: true },
      reasonCode: 'Not Canonical',
      observedAt: 'not-a-timestamp',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_KEY,
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE,
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_REASON_CODE,
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_OBSERVED_AT,
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.UNBOUNDED_TEXT,
      POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.UNSAFE_CONTROL_CHARACTER,
    ]));
  });
});
