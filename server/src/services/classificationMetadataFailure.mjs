/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';

/** Keep the failure boundary, never the credential-bearing upstream exception. */
export class ClassificationMetadataFailure extends Error {
  constructor(error, detailsRequest = true) {
    super('Classification metadata lookup failed');
    this.observation = Object.freeze(tmdbObservationFailure(error));
    this.reasonCode = detailsRequest && this.observation.category === 'not_found'
      ? 'task_metadata_not_found' : 'task_metadata_fetch_failed';
  }
}

export function classificationMetadataFailureReason(error) {
  return error instanceof ClassificationMetadataFailure ? error.reasonCode : null;
}
