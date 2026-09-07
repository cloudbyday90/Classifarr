/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildClassificationCandidateCapture, NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** New membership/manual observations have a known origin but no classifier candidate. */
export function buildNonClassifierHistoryMetadata(metadata, method) {
    if (!NON_CLASSIFIER_CAPTURE_METHODS.includes(method)) throw new Error('Expected a non-classifier history method');
    const source = object(metadata) ? metadata : {};
    return { ...source, classification_details: {
        ...(object(source.classification_details) ? source.classification_details : {}),
        candidate_capture: buildClassificationCandidateCapture({ method }),
    } };
}
