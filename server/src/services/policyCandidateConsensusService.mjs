/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessPolicyCandidateConsensus, consensusPolicyFingerprint } from './policyCandidateConsensus.mjs';
import { CONSENSUS_ROUTE_METHOD, issueCandidateConsensusReceipt } from './policyCandidateConsensusReceipt.mjs';
import { policyCandidateAdjudicationEvidenceService } from './policyCandidateAdjudicationEvidence.mjs';
import { refreshCandidatePolicy } from './policyCandidateRevalidation.mjs';
import * as db from '../config/database.mjs';
import { canonicalStudyModel } from './localStudyEmbeddingClient.mjs';
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';

export function createPolicyCandidateConsensusService({
  readPolicy = refreshCandidatePolicy,
  readEvidence = options => policyCandidateAdjudicationEvidenceService.build(options),
  readConfig = async () => (await db.query('SELECT rag_enabled, primary_provider, ollama_model, ollama_host, ollama_port, configuration_revision FROM ai_provider_config WHERE id=1')).rows[0],
  readLibraries = async ids => (await db.query('SELECT * FROM libraries WHERE id = ANY($1::int[]) AND is_active = true', [ids])).rows,
  now = Date.now,
} = {}) {
  return {
    async prepare(policyResult) {
      if (policyResult?.action !== 'prompt_select' || policyResult?.decisionDiagnostics?.requires_manual_review === true) return null;
      try { return JSON.stringify(await readConfig()) || null; } catch { return null; }
    },
    async resolve({ result, ...input }) {
      try {
        const admitted = assessPolicyCandidateConsensus(input);
        if (!admitted.eligible || result?.candidate_adjudication?.statusId !== 'proposed' ||
            result.library?.id !== admitted.libraryId) return result;
        const config = await readConfig();
        if (!input.consensusContext || input.consensusContext !== JSON.stringify(config) ||
            config?.rag_enabled !== true || config.primary_provider !== 'ollama' || !isTrustedLocalOllamaEndpoint(config.ollama_host) ||
            canonicalStudyModel(config.ollama_model) !== canonicalStudyModel(input.aiMatch.ai_authority.model)) return result;
        const policyFingerprint = consensusPolicyFingerprint(input.policyResult);
        const evidenceFingerprint = JSON.stringify(input.evidence.candidates);
        const currentPolicy = await readPolicy(input.metadata, input.policyResult, input.relatedEvidence);
        if (consensusPolicyFingerprint(currentPolicy) !== policyFingerprint) return result;
        const ids = input.contract.candidates.map(candidate => candidate.libraryId);
        const currentLibraries = await readLibraries(ids);
        if (ids.some(id => JSON.stringify(currentLibraries.find(library => library.id === id)) !==
            JSON.stringify(input.libraries.find(library => library.id === id)))) return result;
        const currentEvidence = await readEvidence({ contract: input.contract, metadata: input.metadata, ragContext: input.ragContext });
        if (JSON.stringify(currentEvidence?.candidates) !== evidenceFingerprint ||
            !assessPolicyCandidateConsensus({ ...input, libraries: currentLibraries, policyResult: currentPolicy, evidence: currentEvidence }).eligible) return result;
        if (JSON.stringify(await readConfig()) !== JSON.stringify(config)) return result;
        return issueCandidateConsensusReceipt({ ...result, policyResult: input.policyResult,
          confidence: admitted.score, method: CONSENSUS_ROUTE_METHOD, format: 'confident', needs_clarification: false,
          reason: 'AI and current library evidence resolved the choice within the configured automatic-route threshold.',
        }, input.metadata, now());
      } catch {
        return result;
      }
    },
  };
}
