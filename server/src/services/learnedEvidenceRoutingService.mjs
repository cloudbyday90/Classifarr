/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import * as db from '../config/database.mjs';
import { getActivePolicies } from './policyEngineQueries.mjs';
import { buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { createLiveInventoryDescriptionRetriever } from './liveInventoryDescriptionRetriever.mjs';
import { assessLearnedEvidenceRouting } from './learnedEvidenceRoutingAssessment.mjs';
import { inspectLearnedEvidenceReviewScope } from './learnedEvidenceReviewScope.mjs';
import { isLocalCandidateProposal } from './policyCandidateProposalAuthority.mjs';
import { consensusPolicyFingerprint } from './policyCandidateConsensus.mjs';
import { refreshCandidatePolicy } from './policyCandidateRevalidation.mjs';
import { CONSENSUS_ROUTE_METHOD, hasCandidateConsensusReceipt, issueCandidateConsensusReceipt } from './policyCandidateConsensusReceipt.mjs';
import { canonicalStudyModel } from './localStudyEmbeddingClient.mjs';
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';
import { assessLearnedEvidenceReview } from './learnedEvidenceReviewResolver.mjs';
import { canAssessLearnedNeighborShadow, assessLearnedNeighborShadow, createLearnedNeighborShadowCounters } from './learnedEvidenceNeighborShadow.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const binding = input => digest([input.metadata, consensusPolicyFingerprint(input.policyResult),
  input.contract, input.libraries, input.evidence, input.relatedEvidence]);
const admittedConfig = config => config?.rag_enabled === true && config.primary_provider === 'ollama' &&
  config.confirmation_setting === 'false' && isTrustedLocalOllamaEndpoint(config.ollama_host);
const withoutNeighbors = evidence => ({ ...evidence, candidates: evidence.candidates.map(candidate => {
  const copy = { ...candidate }; delete copy.neighborCalibration; return copy;
}) });

/** One-use server context plus fresh evidence. No model calls, persistence or score inflation. */
export function createLearnedEvidenceRoutingService({
  readConfig = async () => (await db.query(`SELECT rag_enabled, primary_provider, ollama_model,
    ollama_host, ollama_port, configuration_revision,
    coalesce((SELECT value FROM settings WHERE key='require_all_confirmations'), 'false') AS confirmation_setting
    FROM ai_provider_config WHERE id=1`)).rows[0],
  readPolicies = () => getActivePolicies({ throwOnError: true }),
  readPolicy = refreshCandidatePolicy,
  readLibraries = async ids => (await db.query('SELECT * FROM libraries WHERE id = ANY($1::int[]) AND is_active = true', [ids])).rows,
  retriever = createLiveInventoryDescriptionRetriever({ maxCandidates: 64 }),
  now = Date.now,
} = {}) {
  const contexts = new WeakMap();
  const shadowCounters = createLearnedNeighborShadowCounters();
  let shadowBusy = false;
  return {
    shadowStatus: () => shadowCounters.read(),
    async prepare(input) {
      try {
        if (!['manual', 'prompt_select'].includes(input.policyResult?.action) || !input.evidence) return null;
        const config = await readConfig();
        if (config?.confirmation_setting === 'true') shadowCounters.record('preparation_admin_blocked');
        if (!admittedConfig(config)) return null;
        const policies = await readPolicies();
        // Check whether any shortlisted destination could resolve this soft review before doing extra retrieval.
        if (!input.contract?.candidates.some(candidate => !inspectLearnedEvidenceReviewScope({ ...input, policies,
          aiMatch: { library: { id: candidate.libraryId } } }).reason)) return null;
        const startedAt = now();
        if (!Number.isFinite(startedAt)) return null;
        const token = Object.freeze({});
        contexts.set(token, { config: digest(config), policies: digest(policies), binding: binding(input), startedAt });
        return token;
      } catch { return null; }
    },
    async resolve({ result, learnedContext, ...input }) {
      const context = contexts.get(learnedContext);
      contexts.delete(learnedContext);
      let shadowing = false, shadowOutcome = 'unavailable', shadowSignal;
      try {
        if (!context || hasCandidateConsensusReceipt(result) || !isLocalCandidateProposal(input.aiMatch) ||
            result?.candidate_adjudication?.statusId !== 'proposed' || result.library?.id !== input.aiMatch.library.id ||
            result.candidate_adjudication.proposedDestination?.library_id !== input.aiMatch.library.id || result.needs_retry || result.provider_recovery ||
            !Number.isFinite(now()) || now() < context.startedAt || now() - context.startedAt > 300000 ||
            binding(input) !== context.binding) return result;
        const decisionBinding = digest([result, input.aiMatch]);
        const config = await readConfig(), policies = await readPolicies();
        if (!admittedConfig(config) || digest(config) !== context.config || digest(policies) !== context.policies ||
            canonicalStudyModel(config.ollama_model) !== canonicalStudyModel(input.aiMatch.ai_authority.model) ||
            inspectLearnedEvidenceReviewScope({ ...input, policies }).reason) return result;
        const pool = buildPolicyCandidateAdjudicationPool({ ...input, mediaType: input.metadata.media_type });
        let request = { contract: { valid: true, candidates: pool }, metadata: input.metadata,
          matchLibraryId: input.aiMatch.library.id };
        let evidence = await retriever.retrieve(request);
        const assessment = { ...input, policies, reviewEvidence: evidence };
        if (!assessLearnedEvidenceRouting(assessment)) {
          if (assessLearnedEvidenceReview(assessment).reason !== 'neighbors_disagree') return result;
          if (!canAssessLearnedNeighborShadow(assessment)) { shadowCounters.record('live_guard_blocked'); return result; }
          if (shadowBusy) { shadowCounters.record('busy'); return result; }
          shadowBusy = shadowing = true;
          shadowSignal = AbortSignal.timeout(10_000);
          request = { ...request, neighborCalibration: true, signal: shadowSignal };
          const before = digest(evidence);
          evidence = await retriever.retrieve(request);
          shadowSignal.throwIfAborted();
          if (digest(withoutNeighbors(evidence)) !== before) { shadowOutcome = 'freshness_blocked'; return result; }
          if (!assessLearnedNeighborShadow({ ...input, policies, reviewEvidence: evidence })) {
            shadowOutcome = 'fallback_blocked'; return result;
          }
          shadowOutcome = 'freshness_blocked';
        }
        const assess = shadowing ? assessLearnedNeighborShadow : assessLearnedEvidenceRouting;
        const currentPolicy = await readPolicy(input.metadata, input.policyResult, input.relatedEvidence);
        shadowSignal?.throwIfAborted();
        if (consensusPolicyFingerprint(currentPolicy) !== consensusPolicyFingerprint(input.policyResult)) return result;
        const ids = pool.map(candidate => candidate.libraryId), libraries = await readLibraries(ids);
        if (libraries.length !== ids.length || new Set(libraries.map(library => library.id)).size !== ids.length ||
            ids.some(id => digest(libraries.find(library => library.id === id)) !== digest(input.libraries.find(library => library.id === id)))) return result;
        const fresh = await retriever.retrieve(request);
        shadowSignal?.throwIfAborted();
        if (digest(fresh) !== digest(evidence) || !assess({ ...input, policies, libraries,
          policyResult: currentPolicy, reviewEvidence: fresh })) return result;
        if (digest(await readPolicies()) !== context.policies || digest(await readConfig()) !== context.config ||
            !Number.isFinite(now()) || now() < context.startedAt || now() - context.startedAt > 300000 || binding(input) !== context.binding ||
            digest([result, input.aiMatch]) !== decisionBinding) return result;
        shadowSignal?.throwIfAborted();
        if (shadowing) { shadowOutcome = 'qualified'; return result; }
        const score = currentPolicy.ranked.find(candidate => candidate.library_id === result.library.id).score;
        return issueCandidateConsensusReceipt({ ...result, policyResult: currentPolicy, confidence: score,
          method: CONSENSUS_ROUTE_METHOD, format: 'confident', needs_clarification: false,
          reason: 'AI and fresh library examples agree on this destination; the item also fits this library’s usual description matches.',
        }, input.metadata, now());
      } catch { return result; }
      finally {
        if (shadowing) { shadowBusy = false; shadowCounters.record(shadowOutcome); }
      }
    },
  };
}
