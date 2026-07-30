/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';

import {
  POLICY_RUNTIME_METRIC_COUNTER_IDS,
  buildPolicyRuntimeMetricsTraceFromRuntimeInput,
  validatePolicyRuntimeMetricsTrace,
} from './policyRuntimeMetricsTrace.mjs';

const POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION =
  'policy.runtime_metrics_persistence_admission.v1';
const POLICY_RUNTIME_METRICS_PERSISTENCE_SNAPSHOT_VERSION =
  'policy.runtime_metrics_persistence_snapshot.v1';
const POLICY_RUNTIME_METRICS_TRACE_VERSION = 'policy.runtime_metrics_trace.v1';

const POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS = Object.freeze({
  VALID_METRICS_TRACE: 'valid_metrics_trace',
  RETENTION_POLICY_ADMITTED: 'retention_policy_admitted',
  EXPORT_DISABLED: 'export_disabled',
  UNSUPPORTED_INPUT: 'unsupported_metrics_persistence_input',
  INVALID_METRICS_TRACE: 'invalid_metrics_trace',
  SENSITIVE_METRICS_INPUT: 'sensitive_metrics_input',
  INVALID_RETENTION_POLICY: 'invalid_metrics_retention_policy',
});

const POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_metrics_persistence_admission_version',
  INVALID_STATUS: 'invalid_metrics_persistence_admission_status',
  INVALID_RETENTION_POLICY: 'invalid_metrics_persistence_retention_policy',
  INVALID_SNAPSHOT: 'invalid_metrics_persistence_snapshot',
  SNAPSHOT_FINGERPRINT_MISMATCH: 'metrics_persistence_snapshot_fingerprint_mismatch',
  SENSITIVE_DATA_EXPOSED: 'metrics_persistence_sensitive_data_exposed',
  EXPORT_ENABLED: 'metrics_persistence_export_enabled',
  SIDE_EFFECT_REPORTED: 'metrics_persistence_side_effect_reported',
  READY_WITHOUT_VALID_METRICS: 'metrics_persistence_ready_without_valid_metrics',
  BLOCKED_WITH_SNAPSHOT: 'metrics_persistence_blocked_with_snapshot',
  BLOCKED_WITH_RETENTION: 'metrics_persistence_blocked_with_retention',
});

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 90;
const ADMISSION_INPUT_KEYS = new Set(['metrics', 'retentionDays']);
const COUNTER_IDS = Object.freeze(Object.values(POLICY_RUNTIME_METRIC_COUNTER_IDS));
const METRICS_TRACE_KEYS = Object.freeze([
  'version',
  'counters',
  'traceSummary',
  'traces',
  'operatorSummaries',
  'security',
]);
const SNAPSHOT_KEYS = Object.freeze([
  'version',
  'metricsVersion',
  'counters',
  'traceSummary',
  'security',
  'fingerprint',
]);
const TRACE_SUMMARY_KEYS = Object.freeze([
  'totalTraceCount',
  'emittedTraceCount',
  'truncated',
  'maxTraceRecords',
]);
const METRICS_SECURITY_KEYS = Object.freeze([
  'exposesRawPayload',
  'exposesPrompt',
  'exposesEmbedding',
  'exposesProviderPayload',
  'exposesDiagnosticInternal',
  'rawPayloadSuppressionCount',
]);
const SNAPSHOT_SECURITY_KEYS = Object.freeze(['rawPayloadSuppressionCount']);
const RETENTION_POLICY_KEYS = Object.freeze([
  'retentionDays',
  'minimumRetentionDays',
  'maximumRetentionDays',
  'basisId',
  'expirationRequired',
]);
const EXPORT_KEYS = Object.freeze(['enabled', 'statusId']);
const SIDE_EFFECT_KEYS = Object.freeze([
  'storageChanged',
  'telemetryExported',
  'providerCalled',
  'routeChanged',
  'learningWritten',
  'profileRefreshQueued',
]);
const SENSITIVE_KEYS = Object.freeze([
  'raw',
  'rawPayload',
  'payload',
  'prompt',
  'systemPrompt',
  'userPrompt',
  'embedding',
  'embeddings',
  'vector',
  'providerPayload',
  'identity',
  'email',
  'userId',
  'username',
  'requester',
  'requesterId',
  'operatorId',
  'libraryId',
  'itemId',
  'itemTitle',
  'title',
  'name',
]);
const SENSITIVE_KEY_IDS = new Set(SENSITIVE_KEYS.map(key => key.toLowerCase()));

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      const child = stableValue(value[key]);
      if (child !== undefined) {
        normalized[key] = child;
      }
      return normalized;
    }, {});
}

function sha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function normalizeRetentionDays(value) {
  return Number.isInteger(value) &&
    value >= MIN_RETENTION_DAYS &&
    value <= MAX_RETENTION_DAYS
    ? value
    : null;
}

function hasSensitiveKeyDeep(value) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, child]) =>
    SENSITIVE_KEY_IDS.has(String(key).toLowerCase()) || hasSensitiveKeyDeep(child)
  );
}

function hasExactKeys(value, keys) {
  const source = asObject(value);
  const actualKeys = Object.keys(source).sort();
  const expectedKeys = [...keys].sort();

  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function hasOnlyAdmissionInputKeys(input = {}) {
  return Object.keys(asObject(input)).every(key => ADMISSION_INPUT_KEYS.has(key));
}

function hasValidMetricsTraceShape(metrics = {}) {
  const source = asObject(metrics);

  return hasExactKeys(source, METRICS_TRACE_KEYS) &&
    hasExactKeys(source.counters, COUNTER_IDS) &&
    hasExactKeys(source.traceSummary, TRACE_SUMMARY_KEYS) &&
    hasExactKeys(source.security, METRICS_SECURITY_KEYS) &&
    Array.isArray(source.traces) &&
    Array.isArray(source.operatorSummaries);
}

function buildRetentionPolicy(retentionDays) {
  return {
    retentionDays,
    minimumRetentionDays: MIN_RETENTION_DAYS,
    maximumRetentionDays: MAX_RETENTION_DAYS,
    basisId: 'recorded_at',
    expirationRequired: true,
  };
}

function buildSnapshot(metrics = {}) {
  const source = asObject(metrics);
  const traceSummary = asObject(source.traceSummary);
  const security = asObject(source.security);
  const snapshot = {
    version: POLICY_RUNTIME_METRICS_PERSISTENCE_SNAPSHOT_VERSION,
    metricsVersion: POLICY_RUNTIME_METRICS_TRACE_VERSION,
    counters: Object.fromEntries(COUNTER_IDS.map(counterId => [
      counterId,
      Number(source.counters?.[counterId]),
    ])),
    traceSummary: {
      totalTraceCount: Number(traceSummary.totalTraceCount),
      emittedTraceCount: Number(traceSummary.emittedTraceCount),
      truncated: traceSummary.truncated === true,
      maxTraceRecords: Number(traceSummary.maxTraceRecords),
    },
    security: {
      rawPayloadSuppressionCount: Number(security.rawPayloadSuppressionCount),
    },
  };

  return {
    ...snapshot,
    fingerprint: sha256(snapshot),
  };
}

function buildBlockedAdmission(reasonCodes = []) {
  const result = {
    version: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION,
    ok: false,
    statusId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.BLOCKED,
    reasonCodes: [...new Set(reasonCodes)],
    retention: null,
    snapshot: null,
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
  };

  return {
    ...result,
    audit: buildPolicyRuntimeMetricsPersistenceAdmissionAudit(result),
  };
}

function buildPolicyRuntimeMetricsPersistenceAdmission(input = {}) {
  const source = asObject(input);
  const { metrics, retentionDays = DEFAULT_RETENTION_DAYS } = source;

  if (!hasOnlyAdmissionInputKeys(source)) {
    return buildBlockedAdmission([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.UNSUPPORTED_INPUT,
    ]);
  }

  const validation = validatePolicyRuntimeMetricsTrace(metrics);
  if (hasSensitiveKeyDeep(metrics)) {
    return buildBlockedAdmission([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.SENSITIVE_METRICS_INPUT,
    ]);
  }

  if (
    !hasValidMetricsTraceShape(metrics) ||
    metrics?.version !== POLICY_RUNTIME_METRICS_TRACE_VERSION ||
    !validation.ok
  ) {
    return buildBlockedAdmission([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.INVALID_METRICS_TRACE,
    ]);
  }

  const normalizedRetentionDays = normalizeRetentionDays(retentionDays);
  if (normalizedRetentionDays === null) {
    return buildBlockedAdmission([
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.INVALID_RETENTION_POLICY,
    ]);
  }

  const result = {
    version: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION,
    ok: true,
    statusId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.READY,
    reasonCodes: [
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.VALID_METRICS_TRACE,
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.RETENTION_POLICY_ADMITTED,
      POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_REASON_IDS.EXPORT_DISABLED,
    ],
    retention: buildRetentionPolicy(normalizedRetentionDays),
    snapshot: buildSnapshot(metrics),
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
  };

  return {
    ...result,
    audit: buildPolicyRuntimeMetricsPersistenceAdmissionAudit(result, { metrics }),
  };
}

function hasValidSnapshotStructure(snapshot = {}) {
  const source = asObject(snapshot);
  const counters = asObject(source.counters);
  const traceSummary = asObject(source.traceSummary);
  const security = asObject(source.security);

  return hasExactKeys(source, SNAPSHOT_KEYS) &&
    source.version === POLICY_RUNTIME_METRICS_PERSISTENCE_SNAPSHOT_VERSION &&
    source.metricsVersion === POLICY_RUNTIME_METRICS_TRACE_VERSION &&
    hasExactKeys(counters, COUNTER_IDS) &&
    Object.values(counters).every(isNonNegativeInteger) &&
    hasExactKeys(traceSummary, TRACE_SUMMARY_KEYS) &&
    isNonNegativeInteger(traceSummary.totalTraceCount) &&
    isNonNegativeInteger(traceSummary.emittedTraceCount) &&
    typeof traceSummary.truncated === 'boolean' &&
    Number.isInteger(traceSummary.maxTraceRecords) &&
    traceSummary.maxTraceRecords > 0 &&
    traceSummary.emittedTraceCount <= traceSummary.totalTraceCount &&
    traceSummary.emittedTraceCount <= traceSummary.maxTraceRecords &&
    traceSummary.truncated ===
      (traceSummary.totalTraceCount > traceSummary.emittedTraceCount) &&
    hasExactKeys(security, SNAPSHOT_SECURITY_KEYS) &&
    isNonNegativeInteger(security.rawPayloadSuppressionCount) &&
    !hasSensitiveKeyDeep(source) &&
    /^[a-f0-9]{64}$/u.test(source.fingerprint || '');
}

function buildPolicyRuntimeMetricsPersistenceAdmissionAudit(result = {}, internal = {}) {
  const source = asObject(result);
  const snapshot = asObject(source.snapshot);
  const issues = [];
  const sideEffects = asObject(source.sideEffects);
  const retention = asObject(source.retention);
  const metrics = internal.metrics;

  if (source.version !== POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_VERSION) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Metrics persistence admission must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS)
    .includes(source.statusId)) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Metrics persistence admission must use a supported status.',
    });
  }

  if (
    !hasExactKeys(source.export, EXPORT_KEYS) ||
    source.export?.enabled !== false ||
    source.export?.statusId !== 'disabled'
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.EXPORT_ENABLED,
      message: 'Metrics persistence admission must not enable telemetry export.',
    });
  }

  if (
    !hasExactKeys(sideEffects, SIDE_EFFECT_KEYS) ||
    Object.values(sideEffects).some(value => value !== false)
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Metrics persistence admission must not persist or export telemetry.',
    });
  }

  if (source.statusId === POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.READY) {
    const retentionDays = normalizeRetentionDays(retention.retentionDays);
    if (
      retentionDays === null ||
      !hasExactKeys(retention, RETENTION_POLICY_KEYS) ||
      retention.minimumRetentionDays !== MIN_RETENTION_DAYS ||
      retention.maximumRetentionDays !== MAX_RETENTION_DAYS ||
      retention.basisId !== 'recorded_at' ||
      retention.expirationRequired !== true
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.INVALID_RETENTION_POLICY,
        message: 'Metrics persistence admission must use a bounded expiration policy.',
      });
    }

    const fingerprintInput = { ...snapshot };
    delete fingerprintInput.fingerprint;
    if (!hasValidSnapshotStructure(snapshot)) {
      issues.push({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.INVALID_SNAPSHOT,
        message: 'Metrics persistence admission must contain only a bounded sanitized snapshot.',
      });
    } else if (snapshot.fingerprint !== sha256(fingerprintInput)) {
      issues.push({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.SNAPSHOT_FINGERPRINT_MISMATCH,
        message: 'Metrics persistence snapshot fingerprint must match its bounded contents.',
      });
    }

    if (
      metrics && (
        !hasValidMetricsTraceShape(metrics) ||
        metrics.version !== POLICY_RUNTIME_METRICS_TRACE_VERSION ||
        hasSensitiveKeyDeep(metrics) ||
        validatePolicyRuntimeMetricsTrace(metrics).ok !== true
      )
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.READY_WITHOUT_VALID_METRICS,
        message: 'Ready metrics persistence admission requires a valid metrics trace projection.',
      });
    }
  }

  if (
    source.statusId === POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.BLOCKED &&
    source.snapshot !== null
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.BLOCKED_WITH_SNAPSHOT,
      message: 'Blocked metrics persistence admission must not retain a snapshot.',
    });
  }

  if (
    source.statusId === POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_STATUS_IDS.BLOCKED &&
    source.retention !== null
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_METRICS_PERSISTENCE_ADMISSION_AUDIT_RISK_IDS.BLOCKED_WITH_RETENTION,
      message: 'Blocked metrics persistence admission must not retain retention metadata.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'runtime_rebuild_test_reset',
      label: 'Runtime And Rebuild Test Reset',
      reason: 'Metrics persistence is admitted only as a bounded no-write snapshot; reset coverage can now verify the full runtime contract sequence.',
    },
  };
}

function buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics() {
  return buildPolicyRuntimeMetricsPersistenceAdmission({
    metrics: buildPolicyRuntimeMetricsTraceFromRuntimeInput(),
  }).audit;
}

export {
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
};
