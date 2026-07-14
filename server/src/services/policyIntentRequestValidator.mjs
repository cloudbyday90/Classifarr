/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as z from 'zod';

export const POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION = 1;

export const POLICY_INTENT_DRAFT_BUCKETS = Object.freeze({
  IDENTITY: 'identity_signals',
  COMPATIBILITY: 'compatibility_signals',
  STRICT_CONSTRAINTS: 'strict_constraints',
  BOOSTERS: 'boosters',
  EXCLUSIONS: 'exclusions',
  REVIEW_TRIGGERS: 'review_triggers',
});

const DRAFT_BUCKET_VALUES = Object.freeze(Object.values(POLICY_INTENT_DRAFT_BUCKETS));
const DRAFT_SIGNAL_TYPES = Object.freeze([
  'genres',
  'keywords',
  'studios',
  'language',
  'media_type',
  'certifications',
  'ratings',
  'release_year',
  'vote_average',
  'runtime',
  'review_triggers',
]);
const DRAFT_ENTRY_SOURCES = Object.freeze([
  'intent_draft',
  'intent_edit',
  'legacy_custom_signals',
  'legacy_preset',
  'policy_override',
  'compatibility_fallback',
]);
const DRAFT_PRESET_SOURCES = Object.freeze([
  'legacy_preset',
  'native_intent',
  'intent_draft',
]);
const DRAFT_SOURCES = Object.freeze([
  'legacy_policy_builder',
  'native_intent_draft',
]);
const MAX_DRAFT_JSON_BYTES = 64 * 1024;
const MAX_LEGACY_FIELD_JSON_BYTES = 16 * 1024;

function safeJsonLength(value) {
  try {
    return JSON.stringify(value ?? null).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function boundedUnknownObject(maxBytes, label) {
  return z.record(z.string().trim().min(1).max(80), z.unknown())
    .superRefine((value, ctx) => {
      if (safeJsonLength(value) > maxBytes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must stay below ${maxBytes} serialized bytes.`,
        });
      }
    });
}

function allowListedRecord(keyValues, valueSchema, label) {
  const allowedKeys = new Set(keyValues);

  return z.record(z.string().trim().min(1).max(80), valueSchema)
    .superRefine((value, ctx) => {
      for (const key of Object.keys(value || {})) {
        if (!allowedKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${label} key is not supported by this schema version.`,
          });
        }
      }
    });
}

const scalarValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().finite().min(-100000).max(100000),
  z.boolean(),
]);

const stringListSchema = z.array(
  z.string().trim().min(1).max(120)
).max(50);

const entryValuesSchema = z.object({
  require_all: stringListSchema.optional(),
  require_any: stringListSchema.optional(),
  include: stringListSchema.optional(),
  prefer: stringListSchema.optional(),
  exclude: stringListSchema.optional(),
  mode: z.enum(['max', 'min', 'range', 'runtime_range', 'exclude', 'include']).optional(),
  max: scalarValueSchema.optional(),
  min: scalarValueSchema.optional(),
  min_minutes: z.coerce.number().int().min(0).max(100000).optional(),
  max_minutes: z.coerce.number().int().min(0).max(100000).optional(),
  when_any: stringListSchema.optional(),
}).strict().superRefine((values, ctx) => {
  if (Object.keys(values).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Intent entry values must include at least one supported value.',
    });
  }
});

const entryMetadataSchema = z.object({
  semantics: z.enum(['identity', 'compatibility']).optional(),
  constraint_mode: z.enum(['strict', 'advisory']).optional(),
  constraint: z.enum(['strict', 'advisory']).optional(),
  runtime_mode: z.enum(['strict', 'advisory']).optional(),
  runtime: z.enum(['strict', 'advisory']).optional(),
  strict: z.boolean().optional(),
}).strict();

const entrySchema = z.object({
  bucket: z.enum(DRAFT_BUCKET_VALUES).optional(),
  signal_type: z.enum(DRAFT_SIGNAL_TYPES),
  values: entryValuesSchema,
  metadata: entryMetadataSchema.default({}),
  source: z.enum(DRAFT_ENTRY_SOURCES).optional(),
}).strict();

function bucketSchema(bucketName) {
  return z.array(entrySchema.superRefine((entry, ctx) => {
    if (entry.bucket && entry.bucket !== bucketName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bucket'],
        message: `Entry bucket must match ${bucketName}.`,
      });
    }

    if (bucketName === POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS) {
      const isStrict = entry.metadata.constraint_mode === 'strict'
        || entry.metadata.constraint === 'strict'
        || entry.metadata.runtime_mode === 'strict'
        || entry.metadata.runtime === 'strict'
        || entry.metadata.strict === true;

      if (!isStrict) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata', 'constraint_mode'],
          message: 'Strict constraint entries must carry strict metadata.',
        });
      }
    }

    if (
      bucketName === POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS
      && !Array.isArray(entry.values.exclude)
      && entry.values.mode !== 'exclude'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['values'],
        message: 'Avoid entries must use exclude values or exclude mode.',
      });
    }
  })).max(100);
}

const bucketsSchema = z.object({
  [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.IDENTITY).default([]),
  [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY).default([]),
  [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS).default([]),
  [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS).default([]),
  [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS).default([]),
  [POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS]: bucketSchema(POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS).default([]),
}).strict();

const signalRemovalOverridesSchema = allowListedRecord(
  DRAFT_SIGNAL_TYPES,
  allowListedRecord(
    ['require_all', 'require_any', 'include', 'prefer', 'exclude'],
    stringListSchema,
    'Signal removal override value'
  ),
  'Signal removal override'
);

const signalMetadataOverridesSchema = allowListedRecord(
  DRAFT_SIGNAL_TYPES,
  entryMetadataSchema,
  'Signal metadata override'
);

const draftPresetSchema = z.object({
  preset_id: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/),
  ]).nullable(),
  preset_name: z.string().trim().min(1).max(160).optional(),
  weight: z.coerce.number().min(0.01).max(10).default(1),
  source: z.enum(DRAFT_PRESET_SOURCES).default('intent_draft'),
  migration_state: z.string().trim().min(1).max(80).default('native_candidate'),
  buckets: bucketsSchema,
  signalMetadataOverrides: signalMetadataOverridesSchema.default({}),
  signalRemovalOverrides: signalRemovalOverridesSchema.default({}),
  cleared_signal_types: z.array(z.enum(DRAFT_SIGNAL_TYPES)).max(50).optional(),
  warnings: z.array(boundedUnknownObject(2048, 'Draft warning')).max(50).default([]),
  legacyCustomSignals: boundedUnknownObject(MAX_LEGACY_FIELD_JSON_BYTES, 'Legacy custom signal snapshot').optional(),
  runtimeSemantics: boundedUnknownObject(MAX_LEGACY_FIELD_JSON_BYTES, 'Runtime semantics snapshot').nullable().optional(),
}).strict();

const summarySchema = z.object({
  preset_count: z.coerce.number().int().min(0).max(100).optional(),
  counts: allowListedRecord(
    DRAFT_BUCKET_VALUES,
    z.coerce.number().int().min(0).max(10000),
    'Summary count'
  ).optional(),
}).strict();

const intentDraftSchema = z.object({
  schema_version: z.literal(POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION),
  source: z.enum(DRAFT_SOURCES),
  migration_state: z.string().trim().min(1).max(80).default('native_candidate'),
  presets: z.array(draftPresetSchema).max(100),
  summary: summarySchema.optional(),
}).strict().superRefine((draft, ctx) => {
  if (safeJsonLength(draft) > MAX_DRAFT_JSON_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: `Policy intent draft must stay below ${MAX_DRAFT_JSON_BYTES} serialized bytes.`,
    });
  }

  if (draft.summary?.preset_count !== undefined && draft.summary.preset_count !== draft.presets.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'preset_count'],
      message: 'Summary preset_count must match the number of draft presets.',
    });
  }
});

function formatPath(path) {
  return path.length > 0 ? path.join('.') : '(root)';
}

function normalizeIssues(issues = []) {
  return issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
      return issue.keys.map((key) => ({
        path: formatPath([...(issue.path || []), key]),
        code: issue.code,
        message: `Unrecognized key: "${key}"`,
      }));
    }

    return [{
      path: formatPath(issue.path || []),
      code: issue.code || 'invalid',
      message: issue.message || 'Invalid value',
    }];
  });
}

export class PolicyIntentRequestValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'PolicyIntentRequestValidationError';
    this.code = 'POLICY_INTENT_REQUEST_INVALID';
    this.issues = normalizeIssues(issues);
  }
}

export function validatePolicyIntentDraftRequest(draft) {
  const parsed = intentDraftSchema.safeParse(draft);
  if (!parsed.success) {
    throw new PolicyIntentRequestValidationError(
      'Invalid policy intent draft request',
      parsed.error.issues
    );
  }

  return parsed.data;
}

export function safeValidatePolicyIntentDraftRequest(draft) {
  try {
    return {
      valid: true,
      draft: validatePolicyIntentDraftRequest(draft),
      errors: [],
    };
  } catch (error) {
    if (error instanceof PolicyIntentRequestValidationError) {
      return {
        valid: false,
        draft: null,
        errors: error.issues,
      };
    }
    throw error;
  }
}

export function validatePolicyIntentWritePayload(payload = {}) {
  const draft = payload?.policy_intent_draft ?? payload?.policyIntentDraft;

  if (draft === undefined) {
    return {
      present: false,
      draft: null,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'native_intent_storage_not_enabled',
    };
  }

  const parsedDraft = validatePolicyIntentDraftRequest(draft);

  return {
    present: true,
    draft: parsedDraft,
    validation: {
      valid: true,
      errors: [],
    },
    persistence_enabled: false,
    persistence_reason_code: 'native_intent_storage_not_enabled',
  };
}

export function buildPolicyIntentWritePreflight(payload = {}) {
  const result = validatePolicyIntentWritePayload(payload);

  if (!result.present) {
    return null;
  }

  return {
    present: true,
    validation: result.validation,
    persistence_enabled: result.persistence_enabled,
    persistence_reason_code: result.persistence_reason_code,
    draft_schema_version: result.draft.schema_version,
    source: result.draft.source,
    migration_state: result.draft.migration_state,
    preset_count: result.draft.presets.length,
  };
}

export function summarizePolicyIntentRequestValidationError(error, limit = 5) {
  if (!(error instanceof PolicyIntentRequestValidationError)) {
    return null;
  }

  const issues = error.issues.slice(0, limit);
  const summary = issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ');
  const remaining = Math.max(error.issues.length - issues.length, 0);

  return remaining > 0
    ? `${summary}; +${remaining} more issue${remaining === 1 ? '' : 's'}`
    : summary;
}
