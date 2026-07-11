import { buildPolicyImpactPreviewMigrationVerifier } from './policyImpactPreviewMigrationVerifier.mjs';
import {
  buildPolicyReplayPreviewMigrationVerifier,
  buildPolicyReplayPreviewMigrationSampleQuery,
  normalizePolicyReplayPreviewMigrationLimit,
} from './policyReplayPreviewMigrationVerifier.mjs';
import { createPolicyIntentReplayExecutionContext } from './policyIntentReplayExecutionContext.mjs';
import { buildPolicyIntentReplayScoring } from './policyIntentReplayScoring.mjs';
import {
  buildPolicyIntentReplaySampleDiagnostics,
  buildPolicyIntentReplaySampleDiagnosticsQuery,
} from './policyIntentReplaySampleDiagnostics.mjs';
import { buildPolicyIntentReplayEvidenceCompleteness } from './policyIntentReplayEvidenceCompleteness.mjs';
import { buildPolicyIntentReplayEnrichmentEligibility } from './policyIntentReplayEnrichmentEligibility.mjs';
import { buildPolicyIntentReplayProviderReadiness } from './policyIntentReplayProviderReadiness.mjs';
import { buildPolicyIntentReplayEnrichmentAdapterContract } from './policyIntentReplayEnrichmentAdapterContract.mjs';
import { buildPolicyIntentReplayTmdbMetadataAdapterPreview } from './policyIntentReplayTmdbMetadataAdapter.mjs';
import { buildPolicyIntentReplayTmdbMetadataExecutionSwitch } from './policyIntentReplayTmdbMetadataExecutionSwitch.mjs';
import { createPolicyIntentReplayTmdbMetadataFetcher } from './policyIntentReplayTmdbProviderClient.mjs';
import { buildPolicyIntentReplayTmdbMetadataCoverageComparison } from './policyIntentReplayTmdbMetadataCoverageComparison.mjs';
import { tmdbService as defaultTmdbService } from './tmdb.mjs';

function buildPolicyMigrationVerifierImpactPreview({ previewPolicy, payload }) {
  return buildPolicyImpactPreviewMigrationVerifier({
    policy: previewPolicy,
    payload,
  });
}

async function buildPolicyMigrationVerifierReplayPreview({
  db,
  payload,
  previewPolicy,
  tmdbService = defaultTmdbService,
}) {
  const impactPreview = buildPolicyMigrationVerifierImpactPreview({
    previewPolicy,
    payload,
  });
  const replayLimit = normalizePolicyReplayPreviewMigrationLimit(payload?.replay_limit);
  const sampleQuery = buildPolicyReplayPreviewMigrationSampleQuery({
    libraryId: previewPolicy.library_id,
    mediaType: previewPolicy.library_media_type,
    limit: replayLimit,
  });
  const diagnosticsQuery = buildPolicyIntentReplaySampleDiagnosticsQuery({
    libraryId: previewPolicy.library_id,
    mediaType: previewPolicy.library_media_type,
  });
  const sampleRows = await db.query(sampleQuery.text, sampleQuery.values);
  const diagnosticsRows = await db.query(diagnosticsQuery.text, diagnosticsQuery.values);
  const samples = sampleRows.rows || [];
  const executionContext = createPolicyIntentReplayExecutionContext();
  const scoring = buildPolicyIntentReplayScoring({
    payload,
    samples,
    executionContext,
  });
  const sampleDiagnostics = buildPolicyIntentReplaySampleDiagnostics({
    row: diagnosticsRows.rows?.[0],
    requestedLimit: replayLimit,
    returnedCount: samples.length,
    mediaType: previewPolicy.library_media_type,
  });
  const evidenceCompleteness = buildPolicyIntentReplayEvidenceCompleteness({ samples });
  const enrichmentEligibility = buildPolicyIntentReplayEnrichmentEligibility({ samples });
  const providerReadiness = await buildPolicyIntentReplayProviderReadiness({
    db,
    enrichmentEligibility,
  });
  const tmdbMetadataExecutionSwitch = buildPolicyIntentReplayTmdbMetadataExecutionSwitch({
    requestBody: payload,
    providerReadiness,
  });
  const enrichmentAdapterContract = buildPolicyIntentReplayEnrichmentAdapterContract({
    enrichmentEligibility,
    providerReadiness,
    context: tmdbMetadataExecutionSwitch.adapterContext,
  });
  const tmdbMetadataAdapterPreview = await buildPolicyIntentReplayTmdbMetadataAdapterPreview({
    samples,
    adapterContract: enrichmentAdapterContract,
    context: tmdbMetadataExecutionSwitch.adapterContext,
    executionSwitch: tmdbMetadataExecutionSwitch,
    fetchMovieDetails: tmdbMetadataExecutionSwitch.enabled
      ? createPolicyIntentReplayTmdbMetadataFetcher({ tmdbService })
      : null,
  });
  const tmdbMetadataCoverageComparison = buildPolicyIntentReplayTmdbMetadataCoverageComparison({
    evidenceCompleteness,
    tmdbMetadataAdapterPreview,
  });

  return buildPolicyReplayPreviewMigrationVerifier({
    impactPreview,
    samples,
    scoring,
    sampleDiagnostics,
    evidenceCompleteness,
    enrichmentEligibility,
    providerReadiness,
    enrichmentAdapterContract,
    tmdbMetadataAdapterPreview,
    tmdbMetadataCoverageComparison,
    requestedLimit: replayLimit,
  });
}

export {
  buildPolicyMigrationVerifierImpactPreview,
  buildPolicyMigrationVerifierReplayPreview,
};
