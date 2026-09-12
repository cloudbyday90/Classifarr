/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { consensusPolicyFingerprint } from './policyCandidateConsensus.mjs';

export const CONSENSUS_ROUTE_METHOD = 'library_consensus_auto';
const receiptKey = Symbol('candidateConsensusReceipt');
const receipts = new WeakMap();
const identity = metadata => `${metadata?.media_type}:${metadata?.tmdb_id}`;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** @internal Only the revalidating server service issues these; never accept JSON authority. */
export function issueCandidateConsensusReceipt(result, metadata, now = Date.now()) {
  const token = Object.freeze({});
  receipts.set(token, { identity: identity(metadata), issuedAt: now, policy: consensusPolicyFingerprint(result.policyResult),
    library: digest(result.library), score: result.confidence, proposedId: result.candidate_adjudication?.proposedDestination?.library_id });
  return { ...result, [receiptKey]: token };
}

export function hasCandidateConsensusReceipt(result, { metadata, now = Date.now() } = {}) {
  const receipt = receipts.get(result?.[receiptKey]);
  if (!receipt || !Number.isFinite(now) || result.method !== CONSENSUS_ROUTE_METHOD || result.format !== 'confident' || result.needs_retry || result.needs_clarification ||
      now < receipt.issuedAt || now - receipt.issuedAt > 60000 ||
      (metadata !== undefined && identity(metadata) !== receipt.identity)) return false;
  try {
    return consensusPolicyFingerprint(result.policyResult) === receipt.policy && digest(result.library) === receipt.library &&
      result.confidence === receipt.score && result.candidate_adjudication?.statusId === 'proposed' &&
      result.candidate_adjudication?.proposedDestination?.library_id === receipt.proposedId;
  } catch { return false; }
}
