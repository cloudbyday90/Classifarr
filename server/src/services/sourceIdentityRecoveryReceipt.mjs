/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Reuse only a recent server-owned proof for exactly the same source snapshot. */
export function reusableIdentityRecoveryReceipt(receipt, evidence, now = Date.now()) {
  const verifiedAt = typeof receipt?.verified_at === 'string' ? Date.parse(receipt.verified_at) : NaN;
  return receipt?.version === 1 && receipt.method === 'external_candidate_agreement' &&
    receipt.source_digest === evidence.snapshotDigest && evidence.providerIds.tmdb_id.includes(receipt.tmdb_id) &&
    Number.isFinite(verifiedAt) && verifiedAt <= now && now - verifiedAt < 86400000;
}

export function recoveredIdentity(item, evidence, tmdbId, verifiedAt = new Date().toISOString()) {
  const ids = evidence.providerIds;
  const recovered = { ...structuredClone(item), tmdb_id: tmdbId,
    imdb_id: ids.imdb_id[0], tvdb_id: ids.tvdb_id.length === 1 ? ids.tvdb_id[0] : null };
  delete recovered.provider_identity_invalid;
  delete recovered.provider_identity_issue;
  delete recovered.provider_identity_field;
  delete recovered.source_identity_evidence;
  return { item: recovered, receipt: { version: 1, method: 'external_candidate_agreement',
    source_digest: evidence.snapshotDigest, tmdb_id: tmdbId,
    unresolved_providers: ids.tvdb_id.length > 1 ? ['tvdb_id'] : [], verified_at: verifiedAt } };
}
