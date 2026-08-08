/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyRuntimeDestinationEvidenceSourceEventId,
  getPolicyRuntimeDestinationEvidenceTierId,
} from './policyRuntimeDestinationEvidenceSourceEvent.mjs';
import {
  lockPolicyRuntimeExactItemMemoryExecutionState,
} from './policyRuntimeExactItemMemoryExecutionState.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

function isPolicyRuntimeDestinationEvidenceSourceEvent({
  classification = {},
  intake = {},
  resolution = {},
} = {}) {
  const source = asObject(intake);
  const candidate = asObject(source.candidate);
  const expectedSourceEventId = buildPolicyRuntimeDestinationEvidenceSourceEventId({
    classificationId: normalizeIdentifier(classification.id),
    contractFingerprint: normalizeString(resolution.contractFingerprint, 64),
    tierId: getPolicyRuntimeDestinationEvidenceTierId(source.answerOutcomeId),
    candidateKey: normalizeString(candidate.key, 160),
  });

  return Boolean(expectedSourceEventId) &&
    expectedSourceEventId === normalizeString(source.sourceEventId, 160);
}

async function lockPolicyRuntimeDestinationEvidenceExecutionState({
  client,
  intake = {},
  classificationId = null,
} = {}) {
  return lockPolicyRuntimeExactItemMemoryExecutionState({
    client,
    intake,
    classificationId,
    sourceEventIdValidator: isPolicyRuntimeDestinationEvidenceSourceEvent,
  });
}

export {
  isPolicyRuntimeDestinationEvidenceSourceEvent,
  lockPolicyRuntimeDestinationEvidenceExecutionState,
};
