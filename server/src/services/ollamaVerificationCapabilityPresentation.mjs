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
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS,
} from './ollamaVerificationCapabilityIdentity.mjs';

const PRESENTATIONS = Object.freeze({
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_CHECKED]: Object.freeze({
    label: 'Ollama verification has not been tested',
    message: 'This saved Ollama configuration remains available for general classification, but strict candidate verification will not call AI until it passes a structured-output test.',
    guidance: Object.freeze([
      'Test this saved Ollama configuration before relying on policies that require candidate verification.',
    ]),
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY]: Object.freeze({
    label: 'Ollama verification is ready',
    message: 'This saved Ollama configuration passed the bounded structured-output test and may participate in strict candidate verification.',
    guidance: Object.freeze([
      'Changing the Ollama endpoint or model requires a new test before strict verification can run again.',
    ]),
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY]: Object.freeze({
    label: 'Ollama is classification-only',
    message: 'This saved Ollama configuration could not prove the bounded structured-output contract required for strict candidate verification.',
    guidance: Object.freeze([
      'General AI classification remains available. Re-test after choosing a model that supports JSON Schema output.',
    ]),
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE]: Object.freeze({
    label: 'Ollama verification is unavailable',
    message: 'Classifarr could not complete the bounded structured-output test for this saved Ollama configuration.',
    guidance: Object.freeze([
      'Confirm that Ollama is reachable and the configured model is installed, then test again.',
    ]),
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.MODEL_CHANGED]: Object.freeze({
    label: 'Ollama model changed since verification',
    message: 'The configured Ollama model no longer matches the version that passed the strict verification test. Candidate verification will not call AI until this saved configuration is tested again.',
    guidance: Object.freeze([
      'Test the saved Ollama configuration again before relying on strict candidate verification.',
    ]),
  }),
});

export function buildOllamaVerificationCapabilityPresentation(state) {
  if (!state?.applicable) {
    return null;
  }

  const presentation = PRESENTATIONS[state.statusId]
    || PRESENTATIONS[OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_CHECKED];

  return Object.freeze({
    statusId: state.statusId,
    label: presentation.label,
    message: presentation.message,
    guidance: presentation.guidance,
    checkedAt: state.checkedAt,
    testable: true,
  });
}
