/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { libraryProfileService } from './libraryProfileService.mjs';
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';
import { currentLibraryCandidateRetriever } from './currentLibraryCandidateRetriever.mjs';
import {
  currentLibraryCandidateSemanticRetriever,
} from './currentLibraryCandidateSemanticRetriever.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS,
} from './currentLibraryCandidateRetrievalContract.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';
import {
  buildCurrentLibraryCandidateRetrievalTelemetryProjection,
} from './currentLibraryCandidateRetrievalTelemetry.mjs';

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

function emptyCurrentLibraryEvidence() {
  return {
    statusId: 'not_applicable',
    matchCount: 0,
    directMatch: false,
    topMatchKind: null,
    topRelevance: null,
    items: [],
    semantic: {
      statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      matchCount: 0,
      topRelevance: null,
      outcomeCalibratedMatchCount: 0,
      items: [],
    },
  };
}

function currentLibraryStatusId(value) {
  return Object.values(CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS).includes(value)
    ? value
    : CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE;
}

function boundedCurrentLibraryTitle(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 160) : null;
}

function currentLibraryMatchKind(value) {
  return ['identifier', 'title_year', 'text'].includes(value) ? value : null;
}

function currentLibrarySemanticStatusId(value) {
  return Object.values(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS).includes(value)
    ? value
    : CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE;
}

function boundedMatchCount(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue)
    ? Math.max(0, Math.min(CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE, numericValue))
    : 0;
}

function boundedSemanticMatchCount(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue)
    ? Math.max(0, Math.min(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE, numericValue))
    : 0;
}

function boundedSemanticRelevance(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.min(100, Math.round(numericValue))) : null;
}

function boundedOutcomeCalibratedMatchCount(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue)
    ? Math.max(0, Math.min(
      CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
      numericValue,
    ))
    : 0;
}

function candidateCurrentLibrarySemanticEvidence(retrieval, libraryId) {
  const candidate = (Array.isArray(retrieval?.candidates) ? retrieval.candidates : [])
    .find((item) => Number(item?.libraryId) === libraryId);
  if (!candidate) {
    return emptyCurrentLibraryEvidence().semantic;
  }

  return {
    statusId: currentLibrarySemanticStatusId(retrieval?.statusId),
    matchCount: boundedSemanticMatchCount(candidate.matchCount),
    topRelevance: boundedSemanticRelevance(candidate.topRelevance),
    outcomeCalibratedMatchCount: boundedOutcomeCalibratedMatchCount(
      candidate.outcomeCalibratedMatchCount,
    ),
    items: Array.isArray(candidate.items)
      ? candidate.items.map((item) => ({
        title: boundedCurrentLibraryTitle(item?.title),
        year: Number.isInteger(item?.year) ? item.year : null,
        relevance: boundedSemanticRelevance(item?.relevance) ?? 0,
        outcomeCalibrated: item?.outcomeCalibrated === true,
      })).filter((item) => item.title)
        .slice(0, CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE)
      : [],
  };
}

function candidateCurrentLibraryEvidence(retrieval, semanticRetrieval, libraryId) {
  const candidate = (Array.isArray(retrieval?.candidates) ? retrieval.candidates : [])
    .find((item) => Number(item?.libraryId) === libraryId);
  if (!candidate) {
    return {
      ...emptyCurrentLibraryEvidence(),
      semantic: candidateCurrentLibrarySemanticEvidence(semanticRetrieval, libraryId),
    };
  }

  return {
    statusId: currentLibraryStatusId(retrieval?.statusId),
    matchCount: boundedMatchCount(candidate.matchCount),
    directMatch: candidate.directMatch === true,
    topMatchKind: currentLibraryMatchKind(candidate.topMatchKind),
    topRelevance: Number.isFinite(Number(candidate.topRelevance)) ? Number(candidate.topRelevance) : null,
    items: Array.isArray(candidate.items)
      ? candidate.items.map((item) => ({
        title: boundedCurrentLibraryTitle(item?.title),
        year: Number.isInteger(item?.year) ? item.year : null,
        matchKind: currentLibraryMatchKind(item?.matchKind) || 'text',
        relevance: Number.isFinite(Number(item?.relevance)) ? Number(item.relevance) : 0,
      })).filter((item) => item.title).slice(0, CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE)
      : [],
    semantic: candidateCurrentLibrarySemanticEvidence(semanticRetrieval, libraryId),
  };
}

function remoteCurrentLibraryEvidence(currentLibrary) {
  return {
    statusId: currentLibraryStatusId(currentLibrary?.statusId),
    matchCount: boundedMatchCount(currentLibrary?.matchCount),
    directMatch: currentLibrary?.directMatch === true,
    topMatchKind: currentLibraryMatchKind(currentLibrary?.topMatchKind),
    topRelevance: currentLibrary?.topRelevance ?? null,
    semantic: {
      statusId: currentLibrarySemanticStatusId(currentLibrary?.semantic?.statusId),
      matchCount: boundedSemanticMatchCount(currentLibrary?.semantic?.matchCount),
      topRelevance: boundedSemanticRelevance(currentLibrary?.semantic?.topRelevance),
      outcomeCalibratedMatchCount: boundedOutcomeCalibratedMatchCount(
        currentLibrary?.semantic?.outcomeCalibratedMatchCount,
      ),
    },
  };
}

/**
 * Collects bounded, observed library facts. Profile-read errors become an
 * unavailable profile for that candidate; they never broaden provider input.
 */
export function createPolicyCandidateAdjudicationEvidenceService({
  getProfileStats = null,
  retrieveCurrentLibraryEvidence = null,
  retrieveCurrentLibrarySemanticEvidence = null,
} = {}) {
  const readProfileStats = typeof getProfileStats === 'function'
    ? getProfileStats
    : typeof libraryProfileService.getProfileStats === 'function'
      ? libraryProfileService.getProfileStats.bind(libraryProfileService)
      : async () => null;
  const retrieveCurrentLibrary = typeof retrieveCurrentLibraryEvidence === 'function'
    ? retrieveCurrentLibraryEvidence
    : typeof currentLibraryCandidateRetriever.retrieve === 'function'
      ? currentLibraryCandidateRetriever.retrieve.bind(currentLibraryCandidateRetriever)
      : async () => null;
  const retrieveCurrentLibrarySemantic = typeof retrieveCurrentLibrarySemanticEvidence === 'function'
    ? retrieveCurrentLibrarySemanticEvidence
    : typeof currentLibraryCandidateSemanticRetriever.retrieve === 'function'
      ? currentLibraryCandidateSemanticRetriever.retrieve.bind(currentLibraryCandidateSemanticRetriever)
      : async () => null;

  return Object.freeze({
    async build({ contract = null, ragContext = null, metadata = null } = {}) {
      if (contract?.valid !== true) return null;

      const [currentLibraryRetrieval, currentLibrarySemanticRetrieval] = await Promise.all([
        Promise.resolve().then(() => retrieveCurrentLibrary({ contract, metadata })).catch(() => null),
        Promise.resolve().then(() => retrieveCurrentLibrarySemantic({ contract, metadata })).catch(() => null),
      ]);

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
          currentLibrary: candidateCurrentLibraryEvidence(
            currentLibraryRetrieval,
            currentLibrarySemanticRetrieval,
            candidate.libraryId,
          ),
        });
      }));

      return Object.freeze({
        version: contract.version,
        candidates: Object.freeze(candidates),
        currentLibraryCandidateRetrievalTelemetry:
          buildCurrentLibraryCandidateRetrievalTelemetryProjection(currentLibraryRetrieval?.telemetry),
        currentLibraryCandidateSemanticRetrievalStatusId:
          currentLibrarySemanticStatusId(currentLibrarySemanticRetrieval?.statusId),
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
      currentLibrary: local
        ? candidate.currentLibrary
        : remoteCurrentLibraryEvidence(candidate.currentLibrary),
    }))),
  });
}

export const policyCandidateAdjudicationEvidenceService =
  createPolicyCandidateAdjudicationEvidenceService();
