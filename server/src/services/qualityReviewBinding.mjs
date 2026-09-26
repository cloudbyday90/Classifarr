/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { qualityHash, validQualityProtocol } from './sourcePairQualityContract.mjs';
import { validQualityReviewPacket } from './qualityReviewPacket.mjs';
import { qualityEvidenceTime } from './qualityEvidenceContract.mjs';

export const QUALITY_REVIEW_LIMITS = Object.freeze({ providerCalls: 0, databaseWrites: 0, routingWrites: 0,
  promotionAllowed: false, independenceVerified: false, sourceAuthenticityVerified: false });
export const orderedQualityReviewRows = rows => [...rows].sort((a, b) => a.item < b.item ? -1 : a.item > b.item ? 1 : 0);
export const qualityReviewerId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
export const qualityReviewProvenance = value => ['independent_human.v1', 'synthetic_fixture.v1'].includes(value);

/** Binds exact displayed content as well as protocol membership; does not authenticate it. */
export function qualityReviewContext(protocol, packet) {
  if (!validQualityProtocol(protocol) || !protocol.cases.length || !validQualityReviewPacket(packet, protocol)) {
    throw new Error('quality_review_binding_invalid');
  }
  const cases = orderedQualityReviewRows(protocol.cases);
  const destinations = [...packet.destinations].sort((a, b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
  const packetDigest = qualityHash([packet.version, packet.protocolId, packet.instructions,
    orderedQualityReviewRows(packet.cases).map(row => [row.item, row.mediaType, row.title, row.year, row.description, row.descriptionTruncated]),
    destinations.map(row => [row.target, row.mediaType, row.name])]);
  return { protocol, packetDigest, cases, targets: new Map(protocol.destinations.map(row => [row.target, row.mediaType])),
    expiresAt: new Date(Date.parse(protocol.createdAt) + 720 * 3600000).toISOString() };
}

export function requireQualityReviewTime(context, now, { current = false } = {}) {
  if (!qualityEvidenceTime(now) || Date.parse(now) < Date.parse(context.protocol.createdAt) ||
      current && Date.parse(now) >= Date.parse(context.expiresAt)) throw new Error('quality_review_window_closed');
}
