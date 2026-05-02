/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const classificationEvidenceService = require('./classificationEvidenceService');

/**
 * Build the policy signal context object used to guide AI classification.
 * This is the "context" handed to aiClassify when PolicyEngine has provided
 * ranked results. It is informational - policy scores remain authoritative.
 *
 * @param {object} policyResult      - from policyEngine.evaluateItem()
 * @param {object[]} libraries       - active libraries for this media type
 * @param {object[]} rankedList      - policyResult.ranked
 * @param {object[]} relatedEvidence - from classificationEvidenceService.collectRelatedEvidence()
 * @returns {{ confidence, suggestedLibrary, breakdown, ranked, scores, weights, hasConflict, relatedEvidenceSummary }}
 */
function buildSignalContext(policyResult, libraries, rankedList, relatedEvidence = []) {
  const ranked = Array.isArray(rankedList) ? rankedList : [];
  const top = ranked[0] || null;
  const suggestedLibrary = top ? libraries.find((library) => library.id === top.library_id) : null;

  const breakdown = top?.breakdown?.length ? top.breakdown : (top ? [
    { type: 'preset', score: top.scores?.preset || 0, weight: top.weights?.preset || 0 },
    { type: 'profile', score: top.scores?.profile || 0, weight: top.weights?.profile || 0 },
    { type: 'pattern', score: top.scores?.pattern || 0, weight: top.weights?.pattern || 0 },
    { type: 'rag', score: top.scores?.rag || 0, weight: top.weights?.rag || 0 },
    { type: 'history', score: top.scores?.history || 0, weight: top.weights?.history || 0 },
  ] : []);

  const hasConflict = ranked.length > 1 &&
    top?.score != null &&
    ranked[1]?.score != null
      ? Math.abs(top.score - ranked[1].score) <= 10
      : false;

  return {
    confidence: policyResult?.confidence || 0,
    suggestedLibrary,
    breakdown,
    ranked,
    scores: top?.scores || null,
    weights: top?.weights || null,
    hasConflict,
    relatedEvidenceSummary: classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries),
  };
}

const policyScoringContextBuilder = { buildSignalContext };

module.exports = policyScoringContextBuilder;
module.exports.default = policyScoringContextBuilder;
