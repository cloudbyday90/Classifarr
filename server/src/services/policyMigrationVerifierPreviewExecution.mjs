import { buildPolicyImpactPreviewMigrationVerifier } from './policyImpactPreviewMigrationVerifier.mjs';
import {
  buildPolicyReplayPreviewMigrationVerifier,
  buildPolicyReplayPreviewMigrationSampleQuery,
  normalizePolicyReplayPreviewMigrationLimit,
} from './policyReplayPreviewMigrationVerifier.mjs';
import {
  buildPolicyIntentReplaySampleDiagnostics,
  buildPolicyIntentReplaySampleDiagnosticsQuery,
} from './policyIntentReplaySampleDiagnostics.mjs';
import { buildPolicyIntentReplayEvidenceCompleteness } from './policyIntentReplayEvidenceCompleteness.mjs';

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
  const sampleDiagnostics = buildPolicyIntentReplaySampleDiagnostics({
    row: diagnosticsRows.rows?.[0],
    requestedLimit: replayLimit,
    returnedCount: samples.length,
    mediaType: previewPolicy.library_media_type,
  });
  const evidenceCompleteness = buildPolicyIntentReplayEvidenceCompleteness({ samples });

  return buildPolicyReplayPreviewMigrationVerifier({
    impactPreview,
    samples,
    sampleDiagnostics,
    evidenceCompleteness,
    requestedLimit: replayLimit,
  });
}

export {
  buildPolicyMigrationVerifierImpactPreview,
  buildPolicyMigrationVerifierReplayPreview,
};
