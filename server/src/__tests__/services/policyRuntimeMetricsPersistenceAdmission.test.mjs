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
  POLICY_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_METRIC_COUNTER_IDS,
  buildPolicyRuntimeMetricsTraceFromRuntimeInput,
} from '../../services/policyRuntimeMetricsTrace.mjs';
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS,
  POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS,
  POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION,
  POLICY_RUNTIME_METRICS_PERSISTENCE_SNAPSHOT_VERSION,
  buildPolicyRuntimeMetricsPersistenceAdmission,
  buildPolicyRuntimeMetricsPersistenceAdmissionAudit,
  buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics,
} from '../../services/policyRuntimeMetricsPersistenceAdmission.mjs';

describe('policyRuntimeMetricsPersistenceAdmission', () => {
  function buildValidMetrics() {
    return buildPolicyRuntimeMetricsTraceFromRuntimeInput({
      automationDecisions: [
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
  }

  test('admits only a minimized snapshot with bounded retention and disabled export', () => {
    const admission = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: buildValidMetrics(),
    });

    expect(admission).toEqual(expect.objectContaining({
      version: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION,
      ok: true,
      statusId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.READY,
      retention: {
        retentionDays: DEFAULT_RETENTION_DAYS,
        minimumRetentionDays: MIN_RETENTION_DAYS,
        maximumRetentionDays: MAX_RETENTION_DAYS,
        basisId: 'recorded_at',
        expirationRequired: true,
      },
      export: {
        enabled: false,
        statusId: 'disabled',
      },
      sideEffects: {
        storageChanged: false,
        telemetryExported: false,
        providerCalled: false,
        routeChanged: false,
        learningWritten: false,
        profileRefreshQueued: false,
      },
    }));
    expect(admission.snapshot).toEqual(expect.objectContaining({
      version: POLICY_RUNTIME_METRICS_PERSISTENCE_SNAPSHOT_VERSION,
      metricsVersion: 'policy.runtime_metrics_trace.v1',
      counters: expect.objectContaining({
        [POLICY_RUNTIME_METRIC_COUNTER_IDS.AUTO_ROUTED]: 1,
      }),
      traceSummary: expect.any(Object),
      security: expect.objectContaining({
        rawPayloadSuppressionCount: 0,
      }),
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(Object.keys(admission.snapshot).sort()).toEqual([
      'counters',
      'fingerprint',
      'metricsVersion',
      'security',
      'traceSummary',
      'version',
    ]);
    expect(admission.snapshot).not.toHaveProperty('traces');
    expect(admission.snapshot).not.toHaveProperty('operatorSummaries');
    expect(admission.audit).toEqual(expect.objectContaining({ ok: true }));
  });

  test('fails closed for unsupported, sensitive, or invalid metric input', () => {
    const unsupported = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: buildValidMetrics(),
      rawPayload: { secret: 'must-not-be-admitted' },
    });
    const sensitive = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: {
        ...buildValidMetrics(),
        identity: { email: 'operator@example.test' },
      },
    });
    const invalid = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: {
        version: 'policy.runtime_metrics_trace.v1',
        counters: {},
      },
    });
    const unrecognized = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: {
        ...buildValidMetrics(),
        futureMetric: true,
      },
    });

    expect(unsupported).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.BLOCKED,
      reasonCodes: [
        POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.UNSUPPORTED_INPUT,
      ],
      snapshot: null,
    }));
    expect(sensitive.reasonCodes).toEqual([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.SENSITIVE_METRICS_INPUT,
    ]);
    expect(invalid.reasonCodes).toEqual([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.INVALID_METRICS_TRACE,
    ]);
    expect(unrecognized.reasonCodes).toEqual([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.INVALID_METRICS_TRACE,
    ]);
    expect([unsupported, sensitive, invalid, unrecognized]
      .every(result => result.audit.ok)).toBe(true);
  });

  test.each([0, 91, 1.5, '30', 'not-a-number'])
  ('rejects retention policy value %p outside the bounded range', retentionDays => {
    const admission = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: buildValidMetrics(),
      retentionDays,
    });

    expect(admission).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.BLOCKED,
      reasonCodes: [
        POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.INVALID_RETENTION_POLICY,
      ],
      retention: null,
      snapshot: null,
    }));
  });

  test('detects tampered minimized snapshots and attempted side effects', () => {
    const admission = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: buildValidMetrics(),
      retentionDays: MIN_RETENTION_DAYS,
    });
    const tampered = structuredClone(admission);
    tampered.snapshot.counters[POLICY_RUNTIME_METRIC_COUNTER_IDS.AUTO_ROUTED] += 1;
    tampered.export.enabled = true;
    tampered.export.statusId = 'configured';
    tampered.sideEffects.storageChanged = true;

    const audit = buildPolicyRuntimeMetricsPersistenceAdmissionAudit(tampered);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.SNAPSHOT_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.EXPORT_ENABLED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      }),
    ]));
  });

  test('rejects unbounded metadata shapes even when their known values appear safe', () => {
    const admission = buildPolicyRuntimeMetricsPersistenceAdmission({
      metrics: buildValidMetrics(),
    });
    const tampered = structuredClone(admission);
    tampered.retention.indefinite = false;
    tampered.export.endpoint = 'https://telemetry.example.test';
    delete tampered.sideEffects.profileRefreshQueued;

    const audit = buildPolicyRuntimeMetricsPersistenceAdmissionAudit(tampered);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.INVALID_RETENTION_POLICY,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.EXPORT_ENABLED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      }),
    ]));
  });

  test('keeps the completion-audit handoff explicit without storing telemetry', () => {
    const audit = buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      nextStep: expect.objectContaining({
        stepId: 'runtime_rebuild_test_reset',
        label: 'Runtime And Rebuild Test Reset',
      }),
    }));
  });
});
