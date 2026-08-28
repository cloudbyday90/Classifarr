/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function positiveLibraryId(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function policyCandidateLibrary(policyResult, libraries) {
  const candidateId = positiveLibraryId(
    policyResult?.library?.library_id
      ?? policyResult?.library?.id
      ?? policyResult?.ranked?.[0]?.library_id
      ?? policyResult?.ranked?.[0]?.id,
  );

  if (!candidateId || !Array.isArray(libraries)) return null;

  return libraries.find((library) => positiveLibraryId(library?.id) === candidateId) || null;
}

/**
 * A policy recheck can create a new prompt-confirm candidate after the first
 * classification pass. That candidate must enter the same verification
 * admission path as a first-pass prompt-confirm outcome; otherwise the RAG
 * loop would bypass the strict verification boundary entirely.
 */
export function shouldVerifyPolicyRecheckCandidate({
  existingCandidate = null,
  policyResult = null,
} = {}) {
  return Boolean(existingCandidate) && policyResult?.action === 'prompt_confirm';
}

/**
 * Candidate-bound verification requires the signal context to point to the
 * exact policy candidate. The policy engine and configured libraries are
 * server-owned; this helper deliberately does not use provider output.
 */
export function buildPolicyRecheckVerificationSignalContext({
  signalContext = null,
  policyResult = null,
  libraries = [],
} = {}) {
  const candidate = policyCandidateLibrary(policyResult, libraries);
  if (!candidate) return signalContext;

  const baseContext = signalContext && typeof signalContext === 'object' && !Array.isArray(signalContext)
    ? signalContext
    : {};
  const policyConfidence = Number(policyResult?.confidence);

  return {
    ...baseContext,
    suggestedLibrary: candidate,
    confidence: Number.isFinite(policyConfidence)
      ? policyConfidence
      : baseContext.confidence,
  };
}
