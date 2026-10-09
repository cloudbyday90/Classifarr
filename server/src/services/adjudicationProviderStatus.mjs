/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { FRESH_POLICY_CONFIG_SQL } from './freshInventoryPolicyRuntime.mjs';
import { createLocalDescriptionBenchmarkClient } from './localDescriptionBenchmarkClient.mjs';

const diagnoses = new Map([
  ['description_benchmark_model_ambiguous', ['model_ambiguous',
    'The configured endpoint lists this model more than once. If the server runs Ollama 0.40.1, update it to 0.40.2, which fixes duplicate listings after model conversion. Otherwise, review the provider model mapping. Repeat this check before enabling capture. Do not delete models or bypass digest checks.']],
  ['description_benchmark_installed_local_model_required', ['model_missing',
    'The configured model was not found in the local model listing. Verify the configured endpoint and model name; this check does not install models.']],
  ['description_benchmark_remote_model', ['remote_model',
    'The configured model is remote. This capture worker requires an installed local model and does not fall back to cloud inference.']],
  ['description_benchmark_model_identity_invalid', ['model_identity_invalid',
    'The provider did not return a valid model digest. Check the provider or proxy compatibility; do not disable identity validation.']],
  ['description_benchmark_model_capability_invalid', ['model_capability_invalid',
    'The model must support local completion and report at least 8192 context tokens. Verify the configured model and provider metadata.']],
  ['description_benchmark_local_provider_required', ['unsupported_provider',
    'This optional capture worker supports only the configured local Ollama provider. Ordinary classification is separate.']],
  ['local_study_endpoint_required', ['unsupported_endpoint',
    'The configured endpoint does not meet the local-provider trust policy. Review the saved provider settings; do not weaken endpoint validation.']],
  ['local_study_embedding_model_invalid', ['invalid_model_name',
    'The configured model name is unsupported for local capture. Review the saved model setting.']],
  ['description_benchmark_provider_failed', ['provider_unavailable',
    'The model-inspection request failed. Check provider availability and sanitized provider logs before retrying.']],
]);
const unknown = ['inspection_unavailable',
  'Model inspection could not be verified. Open a GitHub issue from the project issue page with this sanitized report, image version and related log IDs; exclude secrets, prompts and raw provider responses.'];

/** Inspect metadata only. Read-only configuration access ends before any provider HTTP. */
export async function readAdjudicationProviderStatus(database, { createClient = createLocalDescriptionBenchmarkClient,
  signal, now = () => new Date().toISOString() } = {}) {
  const abort = AbortSignal.any([AbortSignal.timeout(15000), ...[signal].filter(Boolean)]);
  const report = { version: 'adjudication_provider_status.v1', checkedAt: now(),
    scope: 'provider_metadata_only', generationCalls: 0, databaseWrites: 0, capturePermissionChanged: false };
  try {
    abort.throwIfAborted();
    const config = await database.withTransaction(async client => {
      await client.query('SET TRANSACTION READ ONLY');
      await client.query("SET LOCAL statement_timeout='3s'");
      await client.query("SET LOCAL lock_timeout='1s'");
      const result = await client.query(FRESH_POLICY_CONFIG_SQL);
      abort.throwIfAborted();
      return result.rows[0];
    });
    abort.throwIfAborted();
    await createClient(config).inspect(abort);
    abort.throwIfAborted();
    return { ...report, status: 'complete', providerStatus: 'ready',
      recovery: 'Provider metadata passed. Inventory, policy replay, quota and resource admission are separate checks; this command does not enable capture.' };
  } catch (error) {
    const [providerStatus, recovery] = signal?.aborted
      ? ['cancelled', 'Inspection was cancelled. No generation was requested; repeat the check only when needed.']
      : abort.aborted
        ? ['inspection_timeout', 'Provider inspection exceeded its deadline. Check availability before retrying; no generation was requested.']
        : diagnoses.get(error?.message) ?? unknown;
    return { ...report, status: 'blocked', providerStatus, recovery };
  }
}
