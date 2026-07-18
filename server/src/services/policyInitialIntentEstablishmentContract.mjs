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
import * as z from 'zod';
import {
  POLICY_INTENT_COLLECTIONS,
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
  POLICY_INTENT_SOURCES,
  SUPPORTED_POLICY_INTENT_OPERATORS,
  SUPPORTED_POLICY_INTENT_SIGNAL_TYPES,
  validatePolicyIntentContract,
} from './policyIntentSchema.mjs';

const POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION = 1;
const POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID = 'operator_declared_intent';
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_RULES_PER_COLLECTION = 32;
const MAX_VALUES_PER_RULE = 50;

const POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS = Object.freeze({
  ESTABLISHED: 'initial_intent_established',
  REPLAYED: 'initial_intent_establishment_replayed',
  BLOCKED_BY_REQUEST: 'initial_intent_establishment_request_invalid',
  BLOCKED_BY_AUTHORITY: 'initial_intent_establishment_authority_blocked',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'initial_intent_establishment_transaction_required',
  FAILED_ROLLED_BACK: 'initial_intent_establishment_failed_rolled_back',
});

const POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS = Object.freeze({
  ACTOR_REQUIRED: 'actor_required',
  ACTIVE_NATIVE_INTENT: 'active_native_intent',
  DECLARED_INTENT_INVALID: 'declared_intent_invalid',
  EXISTING_ESTABLISHMENT: 'existing_initial_establishment',
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
  LEGACY_CONFIGURATION_PRESENT: 'legacy_configuration_present',
  NATIVE_INTENT_HISTORY_PRESENT: 'native_intent_history_present',
  POLICY_NOT_FOUND: 'policy_not_found',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  TRANSACTION_FAILED: 'transaction_failed',
});

const IDENTITY_CAPABLE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'media_type']);
const scalarValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().finite().min(-100000).max(100000),
  z.boolean(),
]);

const stringListSchema = z.array(
  z.string().trim().min(1).max(120)
).min(1).max(MAX_VALUES_PER_RULE);

const valuesSchema = z.object({
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
}).strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rule values must include at least one supported value.',
    });
  }
});

const declaredRuleSchema = z.object({
  signal_type: z.enum(SUPPORTED_POLICY_INTENT_SIGNAL_TYPES),
  operator: z.enum(SUPPORTED_POLICY_INTENT_OPERATORS),
  values: valuesSchema,
  constraint_mode: z.enum(['strict', 'advisory']).nullable().optional(),
  semantics: z.enum(['identity', 'compatibility']).nullable().optional(),
}).strict();

const declaredIntentSchema = z.object({
  purpose: z.array(declaredRuleSchema).min(1).max(MAX_RULES_PER_COLLECTION),
  hard_limits: z.array(declaredRuleSchema).max(MAX_RULES_PER_COLLECTION).default([]),
  helpful_hints: z.array(declaredRuleSchema).max(MAX_RULES_PER_COLLECTION).default([]),
  avoid: z.array(declaredRuleSchema).max(MAX_RULES_PER_COLLECTION).default([]),
}).strict().superRefine((value, ctx) => {
  value.purpose.forEach((rule, index) => {
    if (!IDENTITY_CAPABLE_SIGNAL_TYPES.has(rule.signal_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['purpose', index, 'signal_type'],
        message: 'Purpose rules must use an identity-capable signal type.',
      });
    }
  });

  value.hard_limits.forEach((rule, index) => {
    if (rule.constraint_mode !== 'strict') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hard_limits', index, 'constraint_mode'],
        message: 'Hard-limit rules must explicitly use strict constraint mode.',
      });
    }
  });

  value.avoid.forEach((rule, index) => {
    if (rule.operator !== 'exclude') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['avoid', index, 'operator'],
        message: 'Avoid rules must use the exclude operator.',
      });
    }
  });
});

const requestSchema = z.object({
  schema_version: z.literal(POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION),
  idempotency_key: z.string().trim().regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/u,
    'idempotency_key must be 32 to 128 URL-safe characters.'
  ),
  declared_intent: declaredIntentSchema,
}).strict();

function serializedByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function formatPath(path = []) {
  return path.length > 0 ? path.join('.') : '(root)';
}

function normalizeIssues(issues = []) {
  return issues.flatMap(issue => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      return issue.keys.map(key => ({
        code: issue.code,
        path: formatPath([...(issue.path || []), key]),
        message: `Unrecognized key: "${key}"`,
      }));
    }

    return [{
      code: issue.code || 'invalid',
      path: formatPath(issue.path || []),
      message: issue.message || 'Invalid value.',
    }];
  });
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

function mapRule(rule, collection, intentRole) {
  return {
    intent_role: intentRole,
    signal_type: rule.signal_type,
    operator: rule.operator,
    values: rule.values,
    constraint_mode: collection === POLICY_INTENT_COLLECTIONS.HARD_LIMITS
      ? 'strict'
      : (rule.constraint_mode ?? null),
    semantics: collection === POLICY_INTENT_COLLECTIONS.PURPOSE
      ? 'identity'
      : (rule.semantics ?? null),
    source: POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
  };
}

function reviewBehaviorFromPolicy(policy = {}) {
  return {
    auto_classify_threshold: Number.isFinite(Number(policy.auto_classify_threshold))
      ? Number(policy.auto_classify_threshold)
      : null,
    prompt_threshold: Number.isFinite(Number(policy.prompt_threshold))
      ? Number(policy.prompt_threshold)
      : null,
    require_ai_validation: policy.require_ai_validation !== false,
    trust_patterns: policy.trust_patterns !== false,
    trust_rag: policy.trust_rag !== false,
    trust_history: policy.trust_history !== false,
    combination_mode: policy.combination_mode || 'best_match',
  };
}

export class PolicyInitialIntentEstablishmentRequestError extends Error {
  constructor(issues = []) {
    super('Invalid initial native intent establishment request.');
    this.name = 'PolicyInitialIntentEstablishmentRequestError';
    this.code = 'POLICY_INITIAL_INTENT_ESTABLISHMENT_REQUEST_INVALID';
    this.issues = issues;
  }
}

function validatePolicyInitialIntentEstablishmentRequest(payload = {}) {
  if (serializedByteLength(payload) > MAX_REQUEST_BYTES) {
    throw new PolicyInitialIntentEstablishmentRequestError([{
      code: 'payload_too_large',
      path: '(root)',
      message: `Initial intent establishment requests must stay below ${MAX_REQUEST_BYTES} bytes.`,
    }]);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PolicyInitialIntentEstablishmentRequestError(normalizeIssues(parsed.error.issues));
  }

  return parsed.data;
}

function validatePolicyInitialDeclaredIntent(declaredIntent = {}) {
  const parsed = declaredIntentSchema.safeParse(declaredIntent);
  if (!parsed.success) {
    return {
      ok: false,
      declaredIntent: null,
      issues: normalizeIssues(parsed.error.issues),
    };
  }

  return {
    ok: true,
    declaredIntent: parsed.data,
    issues: [],
  };
}

function buildInitialPolicyIntentContract({ policy = {}, declaredIntent = {} } = {}) {
  const contract = {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: policy.id ?? null,
    library_id: policy.library_id ?? null,
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID,
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: (declaredIntent.purpose || []).map(rule => mapRule(
      rule,
      POLICY_INTENT_COLLECTIONS.PURPOSE,
      POLICY_INTENT_ROLES.PURPOSE
    )),
    hard_limits: (declaredIntent.hard_limits || []).map(rule => mapRule(
      rule,
      POLICY_INTENT_COLLECTIONS.HARD_LIMITS,
      POLICY_INTENT_ROLES.HARD_LIMIT
    )),
    helpful_hints: (declaredIntent.helpful_hints || []).map(rule => mapRule(
      rule,
      POLICY_INTENT_COLLECTIONS.HELPFUL_HINTS,
      POLICY_INTENT_ROLES.HELPFUL_HINT
    )),
    avoid: (declaredIntent.avoid || []).map(rule => mapRule(
      rule,
      POLICY_INTENT_COLLECTIONS.AVOID,
      POLICY_INTENT_ROLES.AVOID
    )),
    review_behavior: reviewBehaviorFromPolicy(policy),
    template_links: [],
    warnings: [],
    unsupported_signals: [],
  };

  return {
    ...contract,
    validation: validatePolicyIntentContract(contract),
  };
}

function buildInitialIntentRequestFingerprint(request = {}) {
  const payload = {
    schema_version: request.schema_version,
    declared_intent: request.declared_intent,
  };

  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

export {
  POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION,
  buildInitialIntentRequestFingerprint,
  buildInitialPolicyIntentContract,
  validatePolicyInitialDeclaredIntent,
  validatePolicyInitialIntentEstablishmentRequest,
};
