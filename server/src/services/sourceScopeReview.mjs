/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewInteger } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { readSourceIdentityIssues } from './sourceIdentityIssues.mjs';
import { copySourceCatalogScope } from './sourceCatalogScopePlan.mjs';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/** Stored-evidence-bound, non-persisting draft check. Never an apply receipt. */
export async function reviewSourceScope(db, actorId, key, body) {
  reviewInteger(actorId);
  reviewBody(body, ['offset', 'sourceVersion', 'scope']);
  if (!digest(key) || !digest(body.sourceVersion) || !Number.isSafeInteger(body.offset) ||
      body.offset < 0 || body.offset > 999999999 || Buffer.byteLength(JSON.stringify(body)) > 32768) {
    throw new ValidationError('Invalid scope review request');
  }
  // Snapshot caller fields before awaiting database work.
  const input = JSON.parse(JSON.stringify(body));
  await requireReviewActor(db, actorId);
  const page = await readSourceIdentityIssues(db, input.offset);
  const item = page.items.find(value => value.key === key);
  if (!item || item.sourceVersion !== input.sourceVersion || item.issue !== 'conflicting_provider_ids') {
    throw new ConflictError('The source changed. Refresh items and review the draft again.', { code: 'scope_source_changed' });
  }
  const scope = copySourceCatalogScope(item.mediaType, input.scope);
  if (!scope) throw new ValidationError('Check the scope: use unique seasons and targets, and declare any unmapped seasons.');
  await requireReviewActor(db, actorId);
  return {
    version: 'source_scope_review.v1', asOf: page.asOf,
    sourceKey: key, sourceVersion: item.sourceVersion,
    draftFingerprint: createHash('sha256').update(JSON.stringify([key, item.sourceVersion, scope])).digest('hex'),
    status: 'valid_draft', verification: 'structure_only', canApply: false, persisted: false,
    scope, parentConflict: { issue: item.issue, providerFields: item.providerFields },
    backfill: { eligible: false, excludedScope: 'all', reason: 'episode_and_catalog_evidence_not_verified' },
  };
}
