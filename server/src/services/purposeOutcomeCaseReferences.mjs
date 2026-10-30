/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';

const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const unavailable = status => ({ status, libraryId: null, evidenceKind: null, method: null });

function contextForEvent(value, event) {
  if (value === null) return null;
  const context = readCorrectionDecisionContext(value);
  if (!context || String(context.classificationId) !== event.classificationId || context.capture.mediaType !== event.mediaType ||
      `${context.capture.mediaType}:${context.capture.tmdbId}` !== event.identityKey) throw new Error('purpose_cases_reference_binding');
  return context;
}

/** Original automation and command-reference meaning are separate frozen facts. Never consult current History. */
export function projectPurposeCaseReferences(event) {
  let original;
  if (event.sourceKind === 'history_review') {
    const binding = event.referenceBinding;
    if (!Array.isArray(binding) || binding.length !== 3 || binding[0] !== 'original_automated_destination' || !id(binding[1])) {
      throw new Error('purpose_cases_reference_binding');
    }
    const context = contextForEvent(binding[2], event);
    if (context && (context.capture.status !== 'completed' || context.capture.libraryId !== binding[1] ||
        !CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method))) throw new Error('purpose_cases_reference_binding');
    // V3 independently binds the served original ID even when int32 decision context cannot represent a BIGINT History ID.
    original = { status: 'available', libraryId: binding[1], evidenceKind: 'history_review_original_reference',
      method: context?.capture.method ?? null };
  } else {
    const context = contextForEvent(event.referenceBinding, event);
    original = !context ? unavailable('not_captured') : context.capture.status !== 'completed' ? unavailable('not_completed') :
      !CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method) ? unavailable('not_automated') :
        { status: 'available', libraryId: context.capture.libraryId, evidenceKind: 'frozen_decision_context', method: context.capture.method };
  }
  const commandReference = { kind: event.actionReference, status: event.sourceKind === 'history_review' ? 'available' : 'not_captured',
    libraryId: event.sourceKind === 'history_review' ? original.libraryId : null };
  return { original, commandReference };
}
