/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { FORMULA_CONFIDENCE_CAP, normalizeCombinationMode } from './policyEngineUtils.mjs';
import {
    scoreCertification, scoreGenres, scoreKeywords, scoreStudios,
    scoreReleaseYear, scoreVoteAverage, scoreRuntime, scoreLanguage,
    scoreMediaType, evaluatePresetSignals
} from './policyEngineSignalScoring.mjs';
import {
    calculateAgreementMultiplier, scorePresets, scorePatterns,
    scoreRelatedEvidence, scoreRAG, scoreHistory, scoreProfile, scoreProfileWithDiagnostics
} from './policyEngineSourceScoring.mjs';
import { checkAuthoritativeSignals, getActivePolicies } from './policyEngineQueries.mjs';
import { evaluateItem, evaluatePolicy } from './policyEngineEvaluation.mjs';

export { FORMULA_CONFIDENCE_CAP };
export {
    normalizePresetAttachmentWeight, parseFiniteNumber, hasConfiguredList,
    getCertificationOrder, isAlphaNumericBoundary, textContainsWholeTerm,
    keywordMatchesTerm, isPositiveContribution, normalizeCombinationMode,
    DEFAULT_RAG_WEIGHT, VALID_COMBINATION_MODES,
    MOVIE_CERTIFICATION_ORDER, TV_CERTIFICATION_ORDER
} from './policyEngineUtils.mjs';
export {
    scoreCertification, scoreGenres, scoreKeywords, scoreStudios,
    scoreReleaseYear, scoreVoteAverage, scoreRuntime, scoreLanguage,
    scoreMediaType, evaluatePresetSignals
} from './policyEngineSignalScoring.mjs';
export {
    calculateAgreementMultiplier, scorePresets, scorePatterns,
    scoreRelatedEvidence, scoreRAG, scoreHistory, scoreProfile, scoreProfileWithDiagnostics
} from './policyEngineSourceScoring.mjs';

class PolicyEngine {
    normalizeCombinationMode(...args) { return normalizeCombinationMode(...args); }
    scoreCertification(...args) { return scoreCertification(...args); }
    scoreGenres(...args) { return scoreGenres(...args); }
    scoreKeywords(...args) { return scoreKeywords(...args); }
    scoreStudios(...args) { return scoreStudios(...args); }
    scoreReleaseYear(...args) { return scoreReleaseYear(...args); }
    scoreVoteAverage(...args) { return scoreVoteAverage(...args); }
    scoreRuntime(...args) { return scoreRuntime(...args); }
    scoreLanguage(...args) { return scoreLanguage(...args); }
    scoreMediaType(...args) { return scoreMediaType(...args); }
    evaluatePresetSignals(...args) { return evaluatePresetSignals(...args); }
    calculateAgreementMultiplier(...args) { return calculateAgreementMultiplier(...args); }
    async scorePresets(...args) { return scorePresets(...args); }
    async scorePatterns(...args) { return scorePatterns(...args); }
    async scoreRelatedEvidence(...args) { return scoreRelatedEvidence(...args); }
    async scoreRAG(...args) { return scoreRAG(...args); }
    async scoreHistory(...args) { return scoreHistory(...args); }
    async scoreProfile(...args) { return scoreProfile(...args); }
    async scoreProfileWithDiagnostics(...args) { return scoreProfileWithDiagnostics(...args); }

    async checkAuthoritativeSignals(...args) { return checkAuthoritativeSignals(...args); }
    async getActivePolicies(...args) { return getActivePolicies(...args); }

    async evaluateItem(item, options = {}) {
        return evaluateItem(item, options, {
            checkAuthoritativeSignals: (...a) => this.checkAuthoritativeSignals(...a),
            getActivePolicies: (...a) => this.getActivePolicies(...a),
            evaluatePolicy: (...a) => this.evaluatePolicy(...a),
        });
    }

    async evaluatePolicy(policy, item, ragCache = { matches: [], timestamp: Date.now() }, relatedEvidence = []) {
        return evaluatePolicy(policy, item, ragCache, relatedEvidence, {
            scorePresets: (...a) => this.scorePresets(...a),
            scoreProfile: (...a) => this.scoreProfile(...a),
            scoreProfileWithDiagnostics: (...a) => this.scoreProfileWithDiagnostics(...a),
            scorePatterns: (...a) => this.scorePatterns(...a),
            scoreRAG: (...a) => this.scoreRAG(...a),
            scoreHistory: (...a) => this.scoreHistory(...a),
        });
    }
}

export const policyEngine = new PolicyEngine();
