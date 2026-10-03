/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ROUTING_EXPECTED } from '../../../../scripts/lib/manualRoutingRehearsal.mjs';
import { routingRehearsalEvidence } from '../../../../scripts/lib/routingRehearsalEvidence.mjs';
import { PUBLISHED_ROUTING_SCHEMA } from '../../../../scripts/lib/publishedRoutingReceipt.mjs';

export const SOURCE = '0123456789abcdef0123456789abcdef01234567';
export const DIGEST = `sha256:${'a'.repeat(64)}`;
export const IMAGE = `ghcr.io/cloudbyday90/classifarr@${DIGEST}`;
export const NOW = '2026-08-09T04:00:00.000Z';
export const WORKFLOW = { runId: '123', runAttempt: '2' };
export const ENV = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'cloudbyday90/Classifarr',
  GITHUB_RUN_ID: WORKFLOW.runId, GITHUB_RUN_ATTEMPT: WORKFLOW.runAttempt, GITHUB_SHA: SOURCE };
export function receipt(platform = 'linux/amd64') {
  const candidate = `sha256:${(platform === 'linux/amd64' ? 'b' : 'c').repeat(64)}`;
  return { schemaVersion: PUBLISHED_ROUTING_SCHEMA, status: 'passed', completedAt: NOW, workflow: { ...WORKFLOW },
    subject: { image: IMAGE, sourceRevision: SOURCE, platform, manifestDigest: `sha256:${'d'.repeat(64)}`,
      configDigest: candidate, imageId: candidate, provenance: { repository: 'cloudbyday90/Classifarr',
        signerWorkflow: 'cloudbyday90/Classifarr/.github/workflows/ci.yml', verified: true } },
    routing: routingRehearsalEvidence({ status: 'passed', cleanup: 'passed', candidate,
      baseline: `sha256:${'e'.repeat(64)}`, checks: Object.keys(ROUTING_EXPECTED), ...ROUTING_EXPECTED.complete },
    { sourceRevision: SOURCE, candidateImageId: candidate }) };
}
