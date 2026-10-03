/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolvePublishedRoutingSubject } from './publishedRoutingSubject.mjs';
import { withRoutingBaseline } from './routingBaselineCandidate.mjs';
import { runManualRoutingRehearsal } from './manualRoutingRehearsal.mjs';
import { routingRehearsalEvidence } from './routingRehearsalEvidence.mjs';
import { PUBLISHED_ROUTING_SCHEMA, validatePublishedRoutingReceipt } from './publishedRoutingReceipt.mjs';

/** Candidate is borrowed by immutable ID. Only the historical baseline is built. */
export async function runPublishedRoutingAcceptance({ image, sourceRevision, platform, workflow }, {
  resolveSubject = resolvePublishedRoutingSubject, withBaseline = withRoutingBaseline,
  rehearse = runManualRoutingRehearsal, now = () => new Date().toISOString(),
} = {}) {
  let stage = 'identity';
  try {
    const subject = resolveSubject({ image, sourceRevision, platform });
    stage = 'rehearsal';
    const routing = await withBaseline(async baseline => routingRehearsalEvidence(
      await rehearse({ baseline, candidate: subject.imageId }),
      { sourceRevision, candidateImageId: subject.imageId, baselineImageId: baseline }));
    // Baseline cleanup must finish successfully before evidence can become passed.
    stage = 'evidence';
    const completedAt = now();
    return validatePublishedRoutingReceipt({ schemaVersion: PUBLISHED_ROUTING_SCHEMA, status: 'passed',
      completedAt, workflow, subject, routing }, { image, sourceRevision, platform, workflow, now: completedAt });
  } catch { throw new Error(`published_routing_${stage}_failed`); }
}
