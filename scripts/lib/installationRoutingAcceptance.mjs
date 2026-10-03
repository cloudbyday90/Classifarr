/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { withFrozenUpgradeCandidate } from './frozenUpgradeCandidate.mjs';
import { withRoutingBaseline } from './routingBaselineCandidate.mjs';
import { runManualRoutingRehearsal } from './manualRoutingRehearsal.mjs';
import { routingRehearsalEvidence } from './routingRehearsalEvidence.mjs';
import { runPublishedUpgradeCompose } from './publishedUpgradeCompose.mjs';
import { verifyPublishedUpgradeProvenance } from './publishedUpgradeProvenance.mjs';

/** Both isolated scenarios borrow one image; owners clean up before returning. */
export async function runInstallationWithRouting({ sourceRevision, resourceBudget = false }, {
  candidate = withFrozenUpgradeCandidate, baseline = withRoutingBaseline,
  installation = runPublishedUpgradeCompose, routing = runManualRoutingRehearsal,
  verify = verifyPublishedUpgradeProvenance,
} = {}) {
  verify();
  let stage = 'build';
  try {
    return await candidate(async candidateImageId => {
      stage = 'installation';
      const result = await installation({ candidateImageId, resourceBudget });
      stage = 'evidence';
      assert.equal(result.candidateImageId, candidateImageId);
      stage = 'routing_baseline';
      const evidence = await baseline(async baselineImageId => {
        stage = 'routing_rehearsal';
        const rehearsal = await routing({ baseline: baselineImageId, candidate: candidateImageId });
        return routingRehearsalEvidence(rehearsal, { sourceRevision, candidateImageId, baselineImageId });
      });
      return { ...result, routing: evidence };
    }, { sourceRevision });
  } catch (error) {
    if (/^(frozen_candidate|routing_baseline)_cleanup_failed$/.test(error.message) || /^routing_cleanup_failed:/.test(error.message)) {
      throw new Error('installation_routing_failed:cleanup');
    }
    if (stage === 'installation') throw error;
    throw new Error(`installation_routing_failed:${stage}`);
  }
}
