/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const PROBLEMS = Object.freeze({
  transport: 'The provider request or response stream failed. Connection failure or a blocked redirect may be responsible.',
  timeout: 'The provider request did not finish before its deadline.',
  http_auth: 'The provider rejected access to the request.',
  http_missing: 'The provider could not find the requested endpoint or model.',
  http_rejected: 'The provider rejected the request; retrying unchanged input may not resolve it.',
  http_busy: 'The provider rate-limited the request or reported a server failure.',
  body_limit: 'The provider response exceeded the permitted byte limit.',
  encoding: 'The provider response was not valid UTF-8.',
  json: 'The provider response was not valid JSON.',
  model: 'The response did not identify the requested local model, or identified a remote model.',
  batch: 'The response did not contain exactly one vector per requested description.',
  shape: 'An embedding was missing, empty or outside the supported size limit.',
  dimensions: 'An embedding length did not match the installed model dimensions.',
  nonfinite: 'An embedding contained missing or non-finite numeric values.',
  float32: 'An embedding value could not be stored safely as float32.',
  zero: 'An embedding contained no nonzero values and cannot support similarity.',
  representation: 'The installed model identity, embedding capability or declared dimensions could not be verified.',
  model_changed: 'The configured or installed model changed before the batch could be committed.',
  unknown: 'Description refresh failed outside a recognized provider validation check. This does not establish malformed provider data.',
});
const MODEL_STEPS = 'Check the embedding model selected in AI settings. Verify it is installed locally and supports embeddings. If failures continue, check provider logs for the same time. Do not edit, pad or truncate vectors.';
const REQUEST_STEPS = 'Check the configured local provider endpoint and its access rules. Verify the selected embedding model is installed. Inspect provider logs for request or context-length errors; Classifarr will not silently truncate descriptions.';
const LEGACY_CODES = Object.freeze({
  local_study_installed_model_required: 'representation',
  local_study_embedding_capability_required: 'representation',
  inventory_description_representation_invalid: 'representation',
  inventory_description_provider_changed: 'model_changed',
  inventory_description_model_changed: 'model_changed',
  inventory_description_batch_invalid: 'batch',
});

/** No raw message, response body, nested cause or provider URL is retained. */
export function providerResponseError(issue, phase) {
  return Object.assign(new Error('provider_response_rejected'), {
    code: 'PROVIDER_RESPONSE_INVALID',
    providerResponseIssue: typeof issue === 'string' && Object.hasOwn(PROBLEMS, issue) ? issue : 'unknown',
    providerResponsePhase: ['inspection', 'embedding'].includes(phase) ? phase : 'embedding',
  });
}

export function diagnoseProviderResponse(error) {
  let code = 'unknown', phase = 'refresh';
  try {
    const type = error?.code;
    if (type === 'PROVIDER_RESPONSE_INVALID') {
      const issue = error.providerResponseIssue, source = error.providerResponsePhase;
      if (typeof issue === 'string' && Object.hasOwn(PROBLEMS, issue)) {
        code = issue; phase = ['inspection', 'embedding'].includes(source) ? source : 'embedding';
      }
    } else if (type === 'INVALID_EMBEDDING') {
      const issue = error.embeddingIssue;
      if (['shape', 'dimensions', 'nonfinite', 'float32', 'zero', 'batch'].includes(issue)) {
        code = issue; phase = 'embedding';
      }
    } else {
      const message = error?.message;
      if (typeof message === 'string' && Object.hasOwn(LEGACY_CODES, message)) {
        code = LEGACY_CODES[message]; phase = code === 'batch' ? 'embedding' : 'inspection';
      }
    }
  } catch { code = 'unknown'; phase = 'refresh'; }
  const slowRetry = ['http_auth', 'http_missing', 'http_rejected', 'representation', 'body_limit'].includes(code);
  const steps = code === 'unknown' ? 'Check Classifarr database and refresh logs for this time. Report this fixed code without including credentials, descriptions or provider responses.'
    : code === 'transport' || code === 'timeout' || code === 'http_busy'
      ? 'No action is normally needed after a restart or temporary outage. If failures persist, check that the local provider is running and reachable from Classifarr.'
      : code.startsWith('http_') || ['body_limit', 'encoding', 'json'].includes(code) ? REQUEST_STEPS : MODEL_STEPS;
  return { code, phase, problem: PROBLEMS[code], steps, slowRetry };
}
