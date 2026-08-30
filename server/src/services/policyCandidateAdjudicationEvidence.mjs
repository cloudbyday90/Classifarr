/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { libraryProfileService } from './libraryProfileService.mjs';
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';

const LOCAL_PROVIDER_ID = 'ollama';
const MAX_PROFILE_VALUES = 5;
const MAX_LOCAL_RAG_TITLES = 3;

function itemCountBand(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 1) return 'empty_or_unavailable';
  if (count < 25) return '1-24';
  if (count < 100) return '25-99';
  if (count < 500) return '100-499';
  return '500+';
}

function distribution(values, key) {
  return (Array.isArray(values) ? values : [])
    .map((value) => ({
      label: typeof value?.[key] === 'string' ? value[key].slice(0, 80) : null,
      percentage: Number.isFinite(Number(value?.percentage)) ? Math.round(Number(value.percentage)) : null,
    }))
    .filter((value) => value.label && value.percentage !== null)
    .slice(0, MAX_PROFILE_VALUES);
}

function candidateRagFacts(ragContext, libraryId, includeTitles) {
  const matches = (Array.isArray(ragContext?.similarItems) ? ragContext.similarItems : [])
    .filter((item) => Number(item?.libraryId ?? item?.library_id) === libraryId)
    .slice(0, MAX_LOCAL_RAG_TITLES);
  const similarities = matches
    .map((item) => Number(item?.similarity ?? item?.score))
    .filter(Number.isFinite);

  return {
    matchCount: matches.length,
    topSimilarity: similarities.length ? Math.round(Math.max(...similarities) * 100) : null,
    ...(includeTitles
      ? { titles: matches.map((item) => String(item?.title || '').slice(0, 160)).filter(Boolean) }
      : {}),
  };
}

function localProfile(profile) {
  if (!profile) return { available: false, itemCountBand: 'empty_or_unavailable' };

  return {
    available: true,
    itemCountBand: itemCountBand(profile.totalItems),
    contentRatings: distribution(profile.certificationDistribution, 'certification'),
    topGenres: distribution(profile.genreDistribution, 'genre'),
    topStudios: distribution(profile.studioDistribution, 'studio'),
    topLanguages: distribution(profile.languageDistribution, 'language'),
  };
}

function remoteProfile(profile) {
  return {
    available: profile?.available === true,
    itemCountBand: profile?.itemCountBand || 'empty_or_unavailable',
  };
}

/**
 * Collects bounded, observed library facts. Profile-read errors become an
 * unavailable profile for that candidate; they never broaden provider input.
 */
export function createPolicyCandidateAdjudicationEvidenceService({
  getProfileStats = null,
} = {}) {
  const readProfileStats = typeof getProfileStats === 'function'
    ? getProfileStats
    : typeof libraryProfileService.getProfileStats === 'function'
      ? libraryProfileService.getProfileStats.bind(libraryProfileService)
      : async () => null;

  return Object.freeze({
    async build({ contract = null, ragContext = null } = {}) {
      if (contract?.valid !== true) return null;

      const candidates = await Promise.all(contract.candidates.map(async (candidate) => {
        let profile = null;
        try {
          profile = await readProfileStats(candidate.libraryId);
        } catch (_error) {
          profile = null;
        }

        return Object.freeze({
          libraryNumber: candidate.libraryNumber,
          libraryId: candidate.libraryId,
          libraryName: candidate.libraryName,
          mediaType: candidate.mediaType,
          policyScore: candidate.policyScore,
          profile: localProfile(profile),
          rag: candidateRagFacts(ragContext, candidate.libraryId, true),
        });
      }));

      return Object.freeze({
        version: contract.version,
        candidates: Object.freeze(candidates),
      });
    },
  });
}

/**
 * Remote providers receive aggregate candidate evidence only. Detail is
 * available solely to a syntactically trusted local Ollama endpoint.
 */
export function projectPolicyCandidateAdjudicationEvidenceForProvider(
  evidence = null,
  { providerType = null, providerHost = null } = {},
) {
  if (!evidence || !Array.isArray(evidence.candidates)) return null;

  const local = providerType === LOCAL_PROVIDER_ID
    && isTrustedLocalOllamaEndpoint(providerHost);
  return Object.freeze({
    version: evidence.version,
    candidates: Object.freeze(evidence.candidates.map((candidate) => Object.freeze({
      libraryNumber: candidate.libraryNumber,
      libraryName: candidate.libraryName,
      mediaType: candidate.mediaType,
      policyScore: candidate.policyScore,
      profile: local ? candidate.profile : remoteProfile(candidate.profile),
      rag: local
        ? candidate.rag
        : {
            matchCount: candidate.rag?.matchCount || 0,
            topSimilarity: candidate.rag?.topSimilarity ?? null,
          },
    }))),
  });
}

export const policyCandidateAdjudicationEvidenceService =
  createPolicyCandidateAdjudicationEvidenceService();
