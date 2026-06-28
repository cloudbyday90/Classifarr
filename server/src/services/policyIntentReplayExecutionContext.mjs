/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE = 'dry_run_replay';

export const POLICY_INTENT_REPLAY_OPERATIONS = Object.freeze({
  FULL_CLASSIFICATION: 'full_classification_run',
  AI_CALL: 'ai_call',
  PROVIDER_CALL: 'provider_call',
  ARR_WRITE: 'arr_write',
  PERSISTENCE_WRITE: 'persistence_write',
  RAG_READ: 'rag_read',
  PROFILE_READ: 'profile_read',
  HISTORY_READ: 'history_read',
});

const DEFAULT_BLOCKED_OPERATIONS = Object.freeze(Object.values(POLICY_INTENT_REPLAY_OPERATIONS));
const SAFE_TRACE_PATTERN = /^[A-Za-z0-9:_-]{1,120}$/;

function boundedString(value, fallback = null, maxLength = 120) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeTraceValue(value) {
  const normalized = boundedString(value);
  return normalized && SAFE_TRACE_PATTERN.test(normalized) ? normalized : null;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function buildCapabilities(overrides = {}) {
  return Object.freeze({
    classification_run: overrides.classification_run === true,
    ai_calls_enabled: overrides.ai_calls_enabled === true,
    provider_calls_enabled: overrides.provider_calls_enabled === true,
    arr_writes_enabled: overrides.arr_writes_enabled === true,
    persistence_enabled: overrides.persistence_enabled === true,
    rag_reads_enabled: overrides.rag_reads_enabled === true,
    profile_reads_enabled: overrides.profile_reads_enabled === true,
    history_reads_enabled: overrides.history_reads_enabled === true,
  });
}

function operationCapability(operation, capabilities) {
  switch (operation) {
    case POLICY_INTENT_REPLAY_OPERATIONS.FULL_CLASSIFICATION:
      return capabilities.classification_run;
    case POLICY_INTENT_REPLAY_OPERATIONS.AI_CALL:
      return capabilities.ai_calls_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.PROVIDER_CALL:
      return capabilities.provider_calls_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.ARR_WRITE:
      return capabilities.arr_writes_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.PERSISTENCE_WRITE:
      return capabilities.persistence_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.RAG_READ:
      return capabilities.rag_reads_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.PROFILE_READ:
      return capabilities.profile_reads_enabled;
    case POLICY_INTENT_REPLAY_OPERATIONS.HISTORY_READ:
      return capabilities.history_reads_enabled;
    default:
      return false;
  }
}

export class PolicyIntentReplaySideEffectBlockedError extends Error {
  constructor(operation, details = {}) {
    super(`Policy intent replay blocked operation: ${operation}`);
    this.name = 'PolicyIntentReplaySideEffectBlockedError';
    this.code = 'POLICY_INTENT_REPLAY_SIDE_EFFECT_BLOCKED';
    this.operation = operation;
    this.details = {
      reason: 'dry_run_replay_context',
      ...details,
    };
  }
}

export function serializePolicyIntentReplayExecutionContext(context = {}) {
  const capabilities = buildCapabilities(context.capabilities);
  const blockedOperations = Array.isArray(context.blocked_operations)
    ? context.blocked_operations
    : DEFAULT_BLOCKED_OPERATIONS;

  return {
    schema_version: POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_SCHEMA_VERSION,
    mode: boundedString(context.mode, POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE, 80),
    side_effects_enabled: context.side_effects_enabled === true,
    started_at: toIsoString(context.started_at),
    trace_id: normalizeTraceValue(context.trace_id),
    correlation_id: normalizeTraceValue(context.correlation_id),
    capabilities,
    blocked_operations: blockedOperations
      .map((operation) => boundedString(operation, null, 80))
      .filter(Boolean)
      .slice(0, DEFAULT_BLOCKED_OPERATIONS.length),
  };
}

function createBlockedAdapterMethod(operation, context) {
  return async function blockedReplayOperation(details = {}) {
    return context.assertOperationAllowed(operation, details);
  };
}

export function createPolicyIntentReplayExecutionContext({
  traceId = null,
  correlationId = null,
  startedAt = new Date(),
  capabilities: capabilityOverrides = {},
} = {}) {
  const capabilities = buildCapabilities(capabilityOverrides);
  const blockedOperations = DEFAULT_BLOCKED_OPERATIONS.filter((operation) => (
    !operationCapability(operation, capabilities)
  ));

  const context = {
    schema_version: POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_EXECUTION_CONTEXT_MODE,
    side_effects_enabled: false,
    started_at: toIsoString(startedAt),
    trace_id: normalizeTraceValue(traceId),
    correlation_id: normalizeTraceValue(correlationId),
    capabilities,
    blocked_operations: Object.freeze(blockedOperations),
    assertOperationAllowed(operation, details = {}) {
      const normalizedOperation = boundedString(operation, 'unknown_operation', 80);
      if (!operationCapability(normalizedOperation, capabilities)) {
        throw new PolicyIntentReplaySideEffectBlockedError(normalizedOperation, details);
      }

      return true;
    },
  };

  context.adapters = Object.freeze({
    classification: Object.freeze({
      run: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.FULL_CLASSIFICATION, context),
    }),
    ai: Object.freeze({
      classify: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.AI_CALL, context),
      generate: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.AI_CALL, context),
    }),
    providers: Object.freeze({
      search: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.PROVIDER_CALL, context),
      enrich: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.PROVIDER_CALL, context),
    }),
    arr: Object.freeze({
      route: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.ARR_WRITE, context),
      update: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.ARR_WRITE, context),
    }),
    persistence: Object.freeze({
      write: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.PERSISTENCE_WRITE, context),
      record: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.PERSISTENCE_WRITE, context),
    }),
    rag: Object.freeze({
      search: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.RAG_READ, context),
    }),
    profile: Object.freeze({
      score: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.PROFILE_READ, context),
    }),
    history: Object.freeze({
      score: createBlockedAdapterMethod(POLICY_INTENT_REPLAY_OPERATIONS.HISTORY_READ, context),
    }),
  });

  return Object.freeze(context);
}

export function buildPolicyIntentReplayExecutionSummary(context) {
  const serialized = serializePolicyIntentReplayExecutionContext(
    context || createPolicyIntentReplayExecutionContext()
  );

  return {
    full_classification_run: serialized.capabilities.classification_run,
    ai_calls_enabled: serialized.capabilities.ai_calls_enabled,
    provider_calls_enabled: serialized.capabilities.provider_calls_enabled,
    arr_writes_enabled: serialized.capabilities.arr_writes_enabled,
    persistence_enabled: serialized.capabilities.persistence_enabled,
    execution_context: serialized,
  };
}
