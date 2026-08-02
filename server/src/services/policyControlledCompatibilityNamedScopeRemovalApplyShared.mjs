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

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION =
  'policy.controlled_compatibility_named_scope_removal_apply.v1';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED_BY_AUTHORIZATION: 'blocked_by_authorization',
  BLOCKED_BY_DEPENDENCY: 'blocked_by_dependency',
  BLOCKED_BY_LOCK: 'blocked_by_lock',
  BLOCKED_BY_REPLAY: 'blocked_by_replay',
  BLOCKED_BY_ROLLBACK_EVIDENCE: 'blocked_by_rollback_evidence',
  BLOCKED_BY_SOURCE: 'blocked_by_source',
  ROLLED_BACK_AFTER_AUDIT_FAILURE: 'rolled_back_after_audit_failure',
});

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS = Object.freeze({
  APPLY_AUDIT_WRITE_FAILED: 'apply_audit_write_failed',
  AUTHORIZATION_ACTOR_MISMATCH: 'authorization_actor_mismatch',
  AUTHORIZATION_ALREADY_CONSUMED: 'authorization_already_consumed',
  AUTHORIZATION_EXPIRED: 'authorization_expired',
  AUTHORIZATION_INVALID: 'authorization_invalid',
  AUTHORIZATION_MISSING: 'authorization_missing',
  DEPENDENCY_MISSING: 'dependency_missing',
  FINAL_REPLAY_BLOCKED: 'final_replay_blocked',
  LOCK_NOT_ACQUIRED: 'lock_not_acquired',
  ROLLBACK_EVIDENCE_WRITE_FAILED: 'rollback_evidence_write_failed',
  ROLLBACK_FAILED: 'rollback_failed',
  SOURCE_APPLY_FAILED: 'source_apply_failed',
  SOURCE_PREPARE_FAILED: 'source_prepare_failed',
  UNEXPECTED_SIDE_EFFECT: 'unexpected_side_effect',
  UNKNOWN_STATUS: 'unknown_status',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value) {
  const timestamp = cleanString(value);
  const timestampMs = Date.parse(timestamp);

  return Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : null;
}

function normalizeActor(actor = {}) {
  const value = asObject(actor);

  return {
    id: cleanString(value.id) || null,
    role: cleanString(value.role).toLowerCase() || null,
  };
}

function isTrustedAdminActor(actor = {}) {
  const normalized = normalizeActor(actor);

  return Boolean(normalized.id) && normalized.role === 'admin';
}

function normalizeAuthorizationId(value) {
  const authorizationId = cleanString(value).toLowerCase();

  return UUID_PATTERN.test(authorizationId) ? authorizationId : null;
}

function isSha256Fingerprint(value) {
  return SHA256_FINGERPRINT_PATTERN.test(cleanString(value).toLowerCase());
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalApplySideEffects() {
  return {
    applyAuditWritten: false,
    authorizationConsumed: false,
    filesDeleted: false,
    gitCommandsRun: false,
    rollbackEvidenceWritten: false,
    sourceRestored: false,
    sourceWritten: false,
    storageChanged: false,
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalApplySideEffects,
  buildRisk,
  cleanString,
  isSha256Fingerprint,
  isTrustedAdminActor,
  normalizeActor,
  normalizeAuthorizationId,
  normalizeTimestamp,
};
