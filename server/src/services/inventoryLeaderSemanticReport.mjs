/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const summarize = rows => {
  const ordinary = rows.filter(row => row.kind === 'ambiguous_nomination');
  const supported = ordinary.filter(row => row.status === 'supported');
  return { sampled: rows.length,
    statuses: Object.fromEntries([...new Set(rows.map(row => row.status))].sort().map(status => [status, rows.filter(row => row.status === status).length])),
    placementComparison: { attempted: ordinary.filter(row => row.attempted).length, stableProposals: supported.length,
      baselineAgreements: supported.filter(row => row.before).length, proposedAgreements: supported.filter(row => row.after).length,
      gained: supported.filter(row => !row.before && row.after).length, lost: supported.filter(row => row.before && !row.after).length,
      underReviewVeto: supported.filter(row => row.vetoed).length },
    withheldLibraryProposals: rows.filter(row => row.kind === 'withheld_library' && row.status === 'supported').length };
};

/** No raw model text, identity, context, prompt, destination or private exception is serialized. */
export function buildLeaderSemanticReport(rows, { eligible, retained, excluded, calls, identity, options, usage, failed }) {
  return { protocol: 'inventory_leader_semantic_comparison_v1', status: failed ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
    planFingerprint: createHash('sha256').update(JSON.stringify(rows.map(row => row.plan.fingerprint))).digest('hex'),
    eligible, retained, excluded, requestedCases: options.generateCases, attemptedCases: rows.filter(row => row.attempted).length,
    calls, ...summarize(rows), byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(rows.filter(row => row.mediaType === mediaType)) })),
    byKind: ['ambiguous_nomination', 'withheld_library'].map(kind => ({ kind, ...summarize(rows.filter(row => row.kind === kind)) })),
    inference: { ...usage, maximumCalls: Math.min(options.generateCases, rows.length) * 2, model: identity?.model ?? null,
      digest: identity?.digest ?? null, context: options.context, outputLimit: 64, temperature: 0, seed: 42, inputTruncation: 'unknown' },
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false,
    liveRoutingChanged: false, livePromotionAllowed: false, routingReceiptsCreated: 0, userQuestionsCreated: 0 };
}
