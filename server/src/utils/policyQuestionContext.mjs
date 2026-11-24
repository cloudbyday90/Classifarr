/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Policy-question context helper utilities.
 */
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
  readNativePendingQuestionDestination,
} from '../services/policyRuntimeQuestionPersistenceContract.mjs';

function inspectReferenceIds(values) {
  const ids = new Set();
  let invalid = false;
  for (const value of Array.isArray(values) ? values : []) {
    if (value === null || value === undefined) continue;
    const id = parseCanonicalDatabaseInt32Id(value);
    if (id === null) invalid = true;
    else ids.add(id);
  }
  return { ids: [...ids], invalid };
}
/** @internal */
export function extractQuestionContext(question) {
  const parsed = question && typeof question === 'object' ? question : null;
  const meta = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
  const candidates = Array.isArray(meta.candidates) ? meta.candidates : [];
  const options = Array.isArray(parsed?.options) ? parsed.options : [];
  const policies = inspectReferenceIds(candidates.map((candidate) => candidate?.policy_id));
  const libraries = inspectReferenceIds([
    ...candidates.map((candidate) => candidate?.library_id),
    ...options.map((option) => option?.library_id),
    meta.primary_candidate_library_id,
    meta.question_anchor_library_id,
  ]);
  const invalidNativeDestination = isPolicyRuntimeQuestionPersistenceEnvelope(parsed) &&
    !readNativePendingQuestionDestination(parsed);
  if (policies.invalid || libraries.invalid || invalidNativeDestination) {
    // A partial set cannot prove that the saved question is current.
    return { policyIds: [], libraryIds: [], hasInvalidReferences: true };
  }
  return { policyIds: policies.ids, libraryIds: libraries.ids };
}
/** @internal */
export function buildQuestionContextCacheKey(context = {}) {
  const { ids: policyIds } = inspectReferenceIds(context.policyIds);
  const { ids: libraryIds } = inspectReferenceIds(context.libraryIds);
  return `p:${policyIds.join(',')}|l:${libraryIds.join(',')}`;
}
/** @internal */
export async function getPolicyQuestionContextVersion(db, context = {}) {
  if (context.hasInvalidReferences) return null;
  const { ids: policyIds } = inspectReferenceIds(context.policyIds);
  const { ids: libraryIds } = inspectReferenceIds(context.libraryIds);
  if (policyIds.length === 0 && libraryIds.length === 0) {
    return null;
  }
  const result = await db.query(
    `SELECT GREATEST(
        COALESCE((SELECT MAX(updated_at) FROM libraries WHERE id = ANY($1::int[])), to_timestamp(0)),
        COALESCE((SELECT MAX(updated_at) FROM library_policies WHERE id = ANY($2::int[])), to_timestamp(0)),
        COALESCE((
          SELECT MAX(cp.updated_at)
          FROM content_presets cp
          JOIN policy_presets pp ON pp.preset_id = cp.id
          WHERE pp.policy_id = ANY($2::int[])
        ), to_timestamp(0))
      ) AS context_version`,
    [libraryIds, policyIds]
  );
  const value = result.rows?.[0]?.context_version || null;
  if (!value) {
    return null;
  }
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}
/** @internal */
export function stampPolicyQuestionContext(question, contextVersion, context = {}) {
  if (!question || typeof question !== 'object' || context.hasInvalidReferences) {
    return question;
  }
  const { ids: policyIds } = inspectReferenceIds(context.policyIds);
  const { ids: libraryIds } = inspectReferenceIds(context.libraryIds);
  return {
    ...question,
    meta: {
      ...(question.meta && typeof question.meta === 'object' ? question.meta : {}),
      question_context: {
        version: contextVersion,
        policy_ids: policyIds,
        library_ids: libraryIds,
      },
    },
  };
}
function resolveStoredQuestionContextVersion(question) {
  const meta = question?.meta && typeof question.meta === 'object' ? question.meta : {};
  return meta.question_context?.version || question?.generated_at || null;
}
/** @internal */
export function isPolicyQuestionStale(question, currentContextVersion) {
  if (!question || !currentContextVersion) {
    return false;
  }
  const storedVersion = resolveStoredQuestionContextVersion(question);
  if (!storedVersion) {
    return false;
  }
  const currentTime = new Date(currentContextVersion).getTime();
  const storedTime = new Date(storedVersion).getTime();
  if (Number.isNaN(currentTime) || Number.isNaN(storedTime)) {
    return false;
  }
  return currentTime > storedTime;
}
