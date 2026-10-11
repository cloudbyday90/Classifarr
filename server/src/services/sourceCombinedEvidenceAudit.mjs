/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readSourceCandidates } from './sourceCandidateProjection.mjs';
import { auditSourceIdentityAgreement } from './sourceIdentityAgreementAudit.mjs';
import { scopeEvidenceDigest } from './sourceScopeCatalogEvidence.mjs';

/** Diagnostics only: same-catalog agreement cannot confer repair authority. */
export async function readCombinedEvidenceAudit({ source, scope, plan, comparison, provider, signal }) {
  const candidates = await readSourceCandidates(source.identity, provider, signal);
  const parent = auditSourceIdentityAgreement(candidates);
  const scopeComplete = comparison.total > 0 && comparison.matched === comparison.total &&
    comparison.exclusions.length === 0 && (scope.kind === 'whole_work' || scope.coverage === 'complete');
  const proposalMatchesIdentity = parent.status === 'catalog_agreement' && plan.works.length === 1 &&
    plan.works[0] === parent.candidateTmdbId;
  return { digest: scopeEvidenceDigest(candidates), report: {
    version: 'source_combined_evidence.v1',
    status: scopeComplete && proposalMatchesIdentity ? 'catalog_and_scope_agreement' : 'review_required',
    parentBlockers: parent.blockers, candidateTmdbId: parent.candidateTmdbId,
    scopeComplete, proposalMatchesIdentity, crossProviderVerified: false, automaticRecoveryEligible: false,
  } };
}
