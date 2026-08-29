const TEST_FEEDBACK = Object.freeze({
  verification_ready: Object.freeze({
    level: 'success',
    message: 'Ollama verification passed. Strict candidate verification is ready.',
  }),
  classification_only: Object.freeze({
    level: 'warning',
    message: 'Ollama verification completed, but strict candidate verification is not available. General AI classification remains available.',
  }),
  unavailable: Object.freeze({
    level: 'warning',
    message: 'Ollama verification could not complete. Confirm the saved endpoint and model, then test again.',
  }),
  model_changed: Object.freeze({
    level: 'warning',
    message: 'Ollama verification is no longer current. Re-test the saved configuration before relying on strict candidate verification.',
  }),
  not_checked: Object.freeze({
    level: 'warning',
    message: 'Ollama verification completed, but its saved capability could not be confirmed. Refresh the status and test again.',
  }),
});

const UNKNOWN_TEST_FEEDBACK = Object.freeze({
  level: 'warning',
  message: 'Ollama verification completed, but strict candidate verification is not available.',
});

/**
 * Returns operator-facing, server-status-derived feedback without reflecting
 * provider errors, endpoint details, model identity, or raw model output.
 */
export function getAiVerificationCapabilityTestFeedback(capability = {}) {
  const statusId = capability?.ollamaVerificationCapability?.statusId;
  return TEST_FEEDBACK[statusId] || UNKNOWN_TEST_FEEDBACK;
}
