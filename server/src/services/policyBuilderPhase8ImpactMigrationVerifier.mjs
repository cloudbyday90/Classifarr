/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { buildPolicyConfigurationView } from './policyConfigurationView.mjs';
import {
  POLICY_INTENT_DRAFT_BUCKETS,
  validatePolicyIntentWritePayload,
} from './policyIntentRequestValidator.mjs';

const POLICY_BUILDER_PHASE8_IMPACT_MIGRATION_VERIFIER_SCHEMA_VERSION = 1;

const BUCKETS = Object.freeze([
  POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
  POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY,
  POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
  POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS,
  POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
]);

const HIGH_IMPACT_BUCKETS = new Set([
  POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
  POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
  POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
]);

function emptyBucketCounts() {
  return BUCKETS.reduce((counts, bucket) => ({
    ...counts,
    [bucket]: 0,
  }), {});
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => ({
      ...sorted,
      [key]: sortObject(value[key]),
    }), {});
}

function fingerprintEntry(entry = {}) {
  const comparable = {
    signal_type: entry.signal_type || null,
    values: sortObject(entry.values || {}),
    constraint_mode: entry.constraint_mode || null,
  };

  return createHash('sha256')
    .update(JSON.stringify(comparable))
    .digest('hex');
}

function countFingerprints(entries = []) {
  const counts = new Map();
  for (const entry of entries) {
    const fingerprint = fingerprintEntry(entry);
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  }
  return counts;
}

function countIntersection(left, right) {
  let matches = 0;
  for (const [fingerprint, leftCount] of left.entries()) {
    matches += Math.min(leftCount, right.get(fingerprint) || 0);
  }
  return matches;
}

function metadataConstraintMode(metadata = {}) {
  if (metadata.constraint_mode) return metadata.constraint_mode;
  if (metadata.constraint) return metadata.constraint;
  if (metadata.runtime_mode) return metadata.runtime_mode;
  if (metadata.runtime) return metadata.runtime;
  if (metadata.strict === true) return 'strict';
  return 'advisory';
}

function metadataSemantics(metadata = {}) {
  return metadata.semantics || null;
}

function draftEntryToComparable(entry = {}) {
  return {
    signal_type: entry.signal_type || null,
    values: entry.values || {},
    semantics: metadataSemantics(entry.metadata || {}),
    constraint_mode: metadataConstraintMode(entry.metadata || {}),
  };
}

function legacyViewBuckets(configurationView = {}) {
  return {
    [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: configurationView.identity_signals || [],
    [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: configurationView.compatibility_signals || [],
    [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: configurationView.strict_constraints || [],
    [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: configurationView.boosters || [],
    [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: configurationView.exclusions || [],
  };
}

function draftBuckets(draft = {}) {
  const buckets = BUCKETS.reduce((result, bucket) => ({
    ...result,
    [bucket]: [],
  }), {});

  for (const preset of draft.presets || []) {
    for (const bucket of BUCKETS) {
      const entries = preset?.buckets?.[bucket] || [];
      buckets[bucket].push(...entries.map(draftEntryToComparable));
    }
  }

  return buckets;
}

function summarizeBuckets(buckets) {
  return BUCKETS.reduce((counts, bucket) => ({
    ...counts,
    [bucket]: (buckets[bucket] || []).length,
  }), emptyBucketCounts());
}

function compareBuckets(legacyBuckets, nativeBuckets) {
  return BUCKETS.map((bucket) => {
    const legacyEntries = legacyBuckets[bucket] || [];
    const nativeEntries = nativeBuckets[bucket] || [];
    const matchingSignals = countIntersection(
      countFingerprints(legacyEntries),
      countFingerprints(nativeEntries)
    );
    const removedSignals = Math.max(legacyEntries.length - matchingSignals, 0);
    const addedSignals = Math.max(nativeEntries.length - matchingSignals, 0);
    const reasonCodes = [];

    if (legacyEntries.length !== nativeEntries.length) {
      reasonCodes.push('count_changed');
    }
    if (removedSignals > 0 || addedSignals > 0) {
      reasonCodes.push('signal_set_changed');
    }

    return {
      bucket,
      legacy_count: legacyEntries.length,
      native_count: nativeEntries.length,
      matching_signals: matchingSignals,
      removed_signals: removedSignals,
      added_signals: addedSignals,
      changed: reasonCodes.length > 0,
      reason_codes: reasonCodes,
    };
  });
}

function deriveImpactLevel(changedBuckets) {
  if (changedBuckets.length === 0) {
    return 'none';
  }

  return changedBuckets.some((bucket) => HIGH_IMPACT_BUCKETS.has(bucket.bucket))
    ? 'high'
    : 'medium';
}

function uniqueReasonCodes(bucketComparison) {
  return Array.from(new Set(
    bucketComparison.flatMap((bucket) => bucket.reason_codes || [])
  ));
}

function buildPolicyBuilderPhase8ImpactMigrationVerifier({
  policy = {},
  payload = {},
} = {}) {
  const writePayload = validatePolicyIntentWritePayload(payload);
  if (!writePayload.present) {
    return {
      schema_version: POLICY_BUILDER_PHASE8_IMPACT_MIGRATION_VERIFIER_SCHEMA_VERSION,
      mode: 'non_persistent_migration_verifier',
      persistence_enabled: false,
      validation: writePayload.validation,
      legacy: {
        preset_count: 0,
        counts: emptyBucketCounts(),
        warning_count: 0,
        warning_reason_codes: [],
      },
      native_draft: {
        present: false,
        preset_count: 0,
        counts: emptyBucketCounts(),
      },
      comparison: {
        parity: 'unavailable',
        impact_level: 'unknown',
        changed_buckets: [],
        bucket_deltas: [],
        reason_codes: ['native_draft_missing'],
      },
    };
  }

  const configurationView = buildPolicyConfigurationView(policy);
  const legacyBuckets = legacyViewBuckets(configurationView);
  const nativeBuckets = draftBuckets(writePayload.draft);
  const bucketDeltas = compareBuckets(legacyBuckets, nativeBuckets);
  const changedBucketDeltas = bucketDeltas.filter((bucket) => bucket.changed);
  const impactLevel = deriveImpactLevel(changedBucketDeltas);

  return {
    schema_version: POLICY_BUILDER_PHASE8_IMPACT_MIGRATION_VERIFIER_SCHEMA_VERSION,
    mode: 'non_persistent_migration_verifier',
    persistence_enabled: false,
    validation: writePayload.validation,
    legacy: {
      preset_count: configurationView.presets.length,
      counts: summarizeBuckets(legacyBuckets),
      warning_count: configurationView.warnings.length,
      warning_reason_codes: configurationView.warnings
        .map((warning) => warning.reason_code)
        .filter(Boolean),
    },
    native_draft: {
      present: true,
      draft_schema_version: writePayload.draft.schema_version,
      source: writePayload.draft.source,
      migration_state: writePayload.draft.migration_state,
      preset_count: writePayload.draft.presets.length,
      counts: summarizeBuckets(nativeBuckets),
    },
    comparison: {
      parity: changedBucketDeltas.length === 0 ? 'matching' : 'different',
      impact_level: impactLevel,
      changed_buckets: changedBucketDeltas.map((bucket) => bucket.bucket),
      bucket_deltas: bucketDeltas,
      reason_codes: uniqueReasonCodes(bucketDeltas),
    },
  };
}

export {
  POLICY_BUILDER_PHASE8_IMPACT_MIGRATION_VERIFIER_SCHEMA_VERSION,
  buildPolicyBuilderPhase8ImpactMigrationVerifier,
};
