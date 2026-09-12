/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { assessPolicyCandidateConsensus } from '../../services/policyCandidateConsensus.mjs';
import { consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';

describe('threshold-qualified library consensus', () => {
  test('uses current policy score, never model confidence or a library-name rule', () => {
    const input = consensusFixture();
    input.aiMatch.confidence = 1;
    expect(assessPolicyCandidateConsensus(input)).toEqual({ eligible: true,
      libraryId: 2, score: 86, reason: 'threshold_qualified_consensus' });
  });

  test.each([
    ['low score', i => { i.policyResult.ranked[1].score = 45; }],
    ['absolute score floor', i => { Object.assign(i.policyResult.ranked[1], { score: 69, auto_classify_threshold: 65 }); }],
    ['non-finite score', i => { i.policyResult.ranked[1].score = NaN; }],
    ['missing threshold', i => { delete i.policyResult.ranked[1].auto_classify_threshold; }],
    ['invalid thresholds', i => { i.policyResult.ranked[1].prompt_threshold = 95; }],
    ['manual veto', i => { i.policyResult.decisionDiagnostics = { requires_manual_review: true }; }],
    ['confirmation policy', i => { i.policyResult.action = 'prompt_confirm'; }],
    ['invalid identity', i => { i.metadata.tmdb_id = 0; }],
    ['invalid media', i => { i.metadata.media_type = 'music'; }],
    ['invalid contract', i => { i.contract = { ...i.contract, valid: false }; }],
    ['duplicate contract', i => { i.contract = { ...i.contract, candidates: [i.contract.candidates[0], i.contract.candidates[0]] }; }],
    ['inactive library', i => { i.libraries[1].is_active = false; }],
    ['cross-media library', i => { i.libraries[1].media_type = 'tv'; }],
    ['unknown destination', i => { i.aiMatch.library = { id: 9 }; }],
    ['omitted qualified contender', i => { i.policyResult.ranked.push({ library_id: 4, score: 86, auto_classify_threshold: 85, prompt_threshold: 60 }); }],
    ['abstention', i => { i.aiMatch.needs_clarification = true; }],
    ['retry', i => { i.aiMatch.needs_retry = true; }],
    ['fallback', i => { i.aiMatch.format = 'fallback'; }],
    ['missing authority', i => { delete i.aiMatch.ai_authority; }],
    ['remote provider', i => { i.aiMatch.ai_authority.providerId = 'openai'; }],
    ['provider fallback', i => { i.aiMatch.ai_authority.isFallback = true; }],
    ['downgraded provider', i => { i.aiMatch.ai_authority.downgraded = true; }],
    ['unsupported mode', i => { i.aiMatch.ai_authority.effectiveMode = 'verify'; }],
    ['model route permission', i => { i.aiMatch.ai_authority.sideEffects.canRoute = true; }],
    ['unknown model', i => { i.aiMatch.ai_authority.model = 'unknown'; }],
    ['missing evidence', i => { i.evidence = null; }],
    ['missing comparison', i => { i.evidence.candidates.pop(); }],
    ['null comparison', i => { i.evidence.candidates[0] = null; }],
    ['duplicate comparison', i => { i.evidence.candidates[0] = i.evidence.candidates[1]; }],
    ['wrong evidence media', i => { i.evidence.candidates[0].mediaType = 'tv'; }],
    ['partial index', i => { i.evidence.candidates[1].descriptionEvidence.statusId = 'partial'; }],
    ['stale coverage', i => { i.evidence.candidates[1].descriptionEvidence.indexed = 99; }],
    ['small corpus', i => { i.evidence.candidates[1].descriptionEvidence.learnedProfile.trainingDescriptions = 19; }],
    ['missing profile', i => { delete i.evidence.candidates[1].descriptionEvidence.learnedProfile; }],
    ['neutral winner', i => { i.evidence.candidates[1].descriptionEvidence.learnedProfile.relativeFit = 0; }],
    ['better alternative fit', i => { i.evidence.candidates[0].descriptionEvidence.learnedProfile.relativeFit = 2; }],
    ['shared winner', i => { i.evidence.candidates[1].descriptionEvidence.items[0].sharedAcrossCandidates = true; }],
    ['weak example', i => { i.evidence.candidates[1].descriptionEvidence.items[0].similarity = .74; }],
    ['low mean', i => { i.evidence.candidates[1].descriptionEvidence.items.forEach(item => { item.similarity = .79; }); }],
    ['narrow lead', i => { i.evidence.candidates[0].descriptionEvidence.items.forEach(item => { item.similarity = .89; }); }],
    ['non-finite similarity', i => { i.evidence.candidates[1].descriptionEvidence.items[0].similarity = NaN; }],
    ['null example', i => { i.evidence.candidates[1].descriptionEvidence.items[0] = null; }],
    ['duplicate descriptions', i => { i.evidence.candidates[1].descriptionEvidence.items[0].description = 'Example 2-1'; }],
    ['missing example', i => { i.evidence.candidates[1].descriptionEvidence.items.pop(); }],
    ['contradictory exact identity', i => { i.evidence.candidates[0].currentLibrary.directMatch = true; }],
  ])('keeps review for %s', (_name, mutate) => {
    const input = consensusFixture();
    mutate(input);
    expect(assessPolicyCandidateConsensus(input).eligible).toBe(false);
  });
});
