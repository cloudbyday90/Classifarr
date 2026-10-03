/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildReleaseCandidateEvidence } from '../../../../scripts/lib/releaseCandidateEvidence.mjs';
import { buildPolicyReleaseAcceptanceReadout } from '../../services/policyReleaseAcceptanceManifest.mjs';
import { createAiProviderFaultComposeReceipt } from '../../../../scripts/lib/aiProviderFaultComposeReceipt.mjs';
import { receipt, NOW, SOURCE, DIGEST, WORKFLOW } from './publishedRoutingFixture.mjs';

export const TAG = 'v0.50.0-beta';
export function promotionEvidence() {
  return buildReleaseCandidateEvidence({ tag: TAG, sourceRevision: SOURCE, digest: DIGEST, generatedAt: NOW, workflow: WORKFLOW,
    ciReadout: buildPolicyReleaseAcceptanceReadout({ generatedAt: NOW, isolatedRuntimeAcceptanceStatusId: 'passed', modeId: 'ci',
      repositoryValidationStatusId: 'passed', sourceRevision: SOURCE }),
    providerFaultReceipt: createAiProviderFaultComposeReceipt({ completedAt: NOW, outcome: 'passed', sourceRevision: SOURCE, statusId: 'passed' }),
    consumerSmokeEvidence: { schema_version: 'classifarr.release.published-digest-consumer-smoke.v1', completed_at: NOW,
      image: `ghcr.io/cloudbyday90/classifarr@${DIGEST}`, signer_workflow: 'cloudbyday90/Classifarr/.github/workflows/ci.yml',
      source_repository: 'cloudbyday90/Classifarr', source_revision: SOURCE,
      checks: { compose_configuration: 'validated', compose_startup: 'healthy', migration_readiness: 'ready', provenance: 'verified', runtime_health: 'healthy', teardown: 'completed' } },
    publishedRoutingReceipts: [receipt(), receipt('linux/arm64')],
  });
}
