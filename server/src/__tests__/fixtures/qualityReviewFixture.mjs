/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { qualitySnapshot } from './sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { REVIEW_INSTRUCTIONS } from '../../services/qualityReviewPacket.mjs';
import { createQualityReviewTemplate, finalizeQualityReviewSubmission } from '../../services/qualityReviewTemplates.mjs';

export function qualityReviewFixture(count = 48, now = '2026-09-25T12:00:00.000Z') {
  const snapshot = qualitySnapshot(count); snapshot.observedAt = now;
  const protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  const packet = { version: 'quality_blind_packet.v1', protocolId: protocol.id, instructions: REVIEW_INSTRUCTIONS,
    cases: protocol.cases.map(row => ({ ...row, title: 'PRIVATE title', year: 2020, description: 'PRIVATE description', descriptionTruncated: false })),
    destinations: protocol.destinations.map(row => ({ ...row, name: 'PRIVATE destination' })) };
  return { protocol, packet, now };
}

// Software fixtures only. Human provenance in a contract test is not an actual independent review.
export function qualityTestSubmission(input, reviewerId, mutate = () => {}, provenance = 'synthetic_fixture.v1') {
  const template = createQualityReviewTemplate({ ...input, reviewerId, provenance });
  for (const row of template.labels) row.target = input.protocol.destinations.find(target => target.mediaType === row.mediaType).target;
  if (provenance === 'independent_human.v1') template.independentReviewConfirmed = true;
  mutate(template);
  return finalizeQualityReviewSubmission({ ...input, template });
}
