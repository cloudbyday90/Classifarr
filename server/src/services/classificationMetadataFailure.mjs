/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';
import { randomUUID } from 'node:crypto';
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const contexts = new WeakMap();

/** Keep the failure boundary, never the credential-bearing upstream exception. */
export class ClassificationMetadataFailure extends Error {
  constructor(error, detailsRequest = true, identity = {}) {
    super('Classification metadata lookup failed');
    this.name = 'ClassificationMetadataFailure';
    this.observation = Object.freeze(tmdbObservationFailure(error));
    this.reasonCode = detailsRequest && this.observation.category === 'not_found'
      ? 'task_metadata_not_found' : 'task_metadata_fetch_failed';
    contexts.set(this, Object.freeze({ failureReference: randomUUID(), provider: 'tmdb',
      stage: 'metadata_fetch', operation: detailsRequest ? 'details' : 'enrichment',
      tmdbId: positiveDatabaseInteger(identity.tmdbId), mediaType: canonicalMediaType(identity.mediaType) }));
  }
}

export function classificationMetadataFailureReason(error) {
  return error instanceof ClassificationMetadataFailure ? error.reasonCode : null;
}

export function classificationMetadataFailureLogFields(error, taskId = null) {
  return error instanceof ClassificationMetadataFailure
    ? { ...contexts.get(error), reasonCode: error.reasonCode, metadataFailure: error.observation,
      ...(['number', 'string'].includes(typeof taskId) && /^[1-9][0-9]{0,15}$/u.test(String(taskId)) &&
        Number.isSafeInteger(Number(taskId)) ? { taskId: Number(taskId) } : {}) } : {};
}
