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

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const { mergePresetSignals, normalizeSignalConfig } = require('../utils/policySignals');
const { normalizeMetadataList } = require('../utils/metadataNormalization');

const logger = createLogger('policyQuestionBuilder');

const LANGUAGE_LABELS = {
  // Major world languages
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  // South/Southeast Asian
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  pa: 'Punjabi',
  ur: 'Urdu',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  // European
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  nb: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  tr: 'Turkish',
  uk: 'Ukrainian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  ca: 'Catalan',
  // Middle East / Other
  he: 'Hebrew',
  fa: 'Farsi',
};

class PolicyQuestionBuilder {
  async build({ metadata = {}, policyResult = null, libraries = [], suggestedLibrary = null, ragContext = null, aiResult = null, maxOptions = 3 }) {
    const mediaType = metadata.media_type?.toLowerCase();
    const filteredLibraries = this.filterLibrariesByMediaType(libraries, mediaType);
    const languageConflicts = policyResult?.languageConflicts || [];

    const candidates = this.buildCandidates(policyResult, filteredLibraries, suggestedLibrary, maxOptions);
    if (candidates.length === 0) {
      return this.buildLibrarySelectionQuestion(metadata, filteredLibraries, {
        reason: 'No policy candidates available',
        ragContext,
        aiResult,
        policyResult
      });
    }

    // ── Language conflict check (before preset load) ─────────────────────────
    // If policyEngine flagged language conflicts, surface them now.
    // This must happen before the hasPresets guard, since the conflicting library
    // was excluded from ranked (and therefore has no presets loaded here).
    const originalLanguage = (metadata.original_language || '').toLowerCase();
    if (originalLanguage && languageConflicts.length > 0) {
      const conflictQuestion = this.buildLanguageConflictQuestion(
        metadata, candidates, languageConflicts, { ragContext, aiResult, policyResult }
      );
      if (conflictQuestion) return conflictQuestion;
    }

    const policyIds = Array.from(new Set(candidates.map(c => c.policy_id).filter(Boolean)));
    const presetsByPolicy = await this.getPresetsByPolicy(policyIds);
    const hasPresets = policyIds.some(id => (presetsByPolicy[id] || []).length > 0);

    if (!hasPresets) {
      return this.buildLibrarySelectionQuestion(metadata, candidates.map(c => c.library).filter(Boolean), {
        reason: 'No presets attached to candidate policies',
        candidates,
        ragContext,
        aiResult,
        policyResult
      });
    }

    const languageQuestion = this.buildLanguageQuestion(metadata, candidates, presetsByPolicy, {
      ragContext,
      aiResult,
      policyResult,
      languageConflicts,
    });
    if (languageQuestion) {
      return languageQuestion;
    }

    return this.buildCandidateQuestion(metadata, candidates, presetsByPolicy, {
      ragContext,
      aiResult,
      policyResult
    });
  }

  /**
   * Generate a question when policyEngine detected one or more hard language conflicts.
   * Conflicting libraries were excluded from auto-routing because their presets require
   * a language the item doesn't have (e.g., Anime Movies requires 'ja', item is 'zh').
   * We surface all conflicts here so the user can consciously decide.
   */
  buildLanguageConflictQuestion(metadata, candidates, languageConflicts, extras = {}) {
    if (!languageConflicts || languageConflicts.length === 0) return null;

    const originalLanguage = (metadata.original_language || '').toLowerCase();
    if (!originalLanguage) return null;

    const itemLangLabel = this.formatLanguage(originalLanguage);
    const topCandidate = candidates[0] || null;
    const rankedLibraries = candidates.map(c => c.library).filter(Boolean);
    const conflictLibraries = languageConflicts.map(c => ({ id: c.library_id, name: c.library_name }));
    const orderedLibraries = [];
    const seenLibraryIds = new Set();
    const prioritizedLibraries = [
      topCandidate?.library || null,
      ...conflictLibraries,
      ...rankedLibraries.filter(library => library?.id !== topCandidate?.library?.id)
    ];

    prioritizedLibraries.forEach((library) => {
      if (!library?.id || seenLibraryIds.has(library.id)) {
        return;
      }
      seenLibraryIds.add(library.id);
      orderedLibraries.push(library);
    });

    const requiredOptionCount = Math.max(
      3,
      new Set([
        topCandidate?.library?.id || null,
        ...conflictLibraries.map(library => library.id)
      ].filter(Boolean)).size
    );
    const options = orderedLibraries
      .slice(0, requiredOptionCount)
      .map(lib => this.toOption(lib.name, lib));

    if (options.length < 2) return null;

    // Scale question text to number of conflicts
    let question, whyUncertain;
    if (languageConflicts.length === 1) {
      const conflict = languageConflicts[0];
      const conflictLangLabel = this.formatLanguageList(conflict.required_languages || []);
      if (topCandidate?.library?.name) {
        question = `Top match is "${topCandidate.library.name}" for this ${itemLangLabel} content, but "${conflict.library_name}" has a ${conflictLangLabel} language preference. Which library should this go to?`;
      } else {
        question = `This is ${itemLangLabel} content. "${conflict.library_name}" has a ${conflictLangLabel} language preference. Which library should this go to?`;
      }
      whyUncertain = `Content is in ${itemLangLabel}, but "${conflict.library_name}" is configured for ${conflictLangLabel} content.`;
    } else {
      const conflictNames = languageConflicts.map(c => `"${c.library_name}"`).join(' and ');
      const combinedLanguages = Array.from(new Set(
        languageConflicts.flatMap(conflict => conflict.required_languages || [])
      ));
      const conflictLangLabel = this.formatLanguageList(combinedLanguages);
      if (topCandidate?.library?.name) {
        question = `Top match is "${topCandidate.library.name}" for this ${itemLangLabel} content, but ${conflictNames} have a ${conflictLangLabel} language preference. Which library should this go to?`;
      } else {
        question = `This is ${itemLangLabel} content, but ${conflictNames} have a ${conflictLangLabel} language preference. Which library should this go to?`;
      }
      whyUncertain = `Content is in ${itemLangLabel}, but conflicting libraries are configured for ${conflictLangLabel} content.`;
    }

    const conflictCandidateMeta = languageConflicts.map(c => ({
      library_id: c.library_id,
      library_name: c.library_name,
      score: 0,
      policy_id: c.policy_id,
      policy_name: c.policy_name,
      library: { id: c.library_id, name: c.library_name },
    }));

    return this.buildQuestionPayload(metadata, {
      problem_summary: 'Language conflict',
      why_uncertain: whyUncertain,
      question,
      options,
      candidates: [...candidates, ...conflictCandidateMeta],
      extras: {
        ...extras,
        question_anchor_library: topCandidate?.library || null,
        question_anchor_reason: topCandidate?.library ? 'primary_candidate' : 'manual_review_required',
      },
    });
  }

  filterLibrariesByMediaType(libraries, mediaType) {
    if (!mediaType) {
      return libraries || [];
    }
    return (libraries || []).filter(lib => (lib.media_type || '').toLowerCase() === mediaType);
  }

  buildCandidates(policyResult, libraries, suggestedLibrary, maxOptions) {
    const candidates = [];
    const ranked = Array.isArray(policyResult?.ranked) ? [...policyResult.ranked] : [];
    ranked.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Filter out candidates with very low scores relative to the top candidate
    // to avoid showing irrelevant options (e.g., "Christmas and Hallmark" for a courtroom drama)
    const topScore = ranked[0]?.score || 0;
    const minRelativeScore = topScore * 0.25;
    const relevantRanked = topScore > 0 ? ranked.filter(r => (r.score || 0) >= minRelativeScore) : ranked;

    relevantRanked.forEach(entry => {
      const library = libraries.find(lib => lib.id === entry.library_id);
      if (!library) return;
      candidates.push({
        ...entry,
        library,
      });
    });

    if (candidates.length === 0 && suggestedLibrary) {
      const fallback = libraries.find(lib => lib.id === suggestedLibrary.id) || suggestedLibrary;
      if (fallback) {
        candidates.push({
          library_id: fallback.id,
          library_name: fallback.name,
          score: null,
          policy_id: null,
          policy_name: null,
          library: fallback
        });
      }
    }

    for (const lib of libraries) {
      if (candidates.length >= maxOptions) break;
      if (!candidates.some(c => c.library_id === lib.id)) {
        candidates.push({
          library_id: lib.id,
          library_name: lib.name,
          score: null,
          policy_id: null,
          policy_name: null,
          library: lib
        });
      }
    }

    return candidates.slice(0, maxOptions);
  }

  async getPresetsByPolicy(policyIds) {
    if (!policyIds || policyIds.length === 0) {
      return {};
    }

    try {
      const result = await db.query(
        `SELECT 
           pp.policy_id,
           cp.id as preset_id,
           cp.name as preset_name,
           cp.signals,
           pp.custom_signals
         FROM policy_presets pp
         JOIN content_presets cp ON pp.preset_id = cp.id
         WHERE pp.policy_id = ANY($1::int[])`,
        [policyIds]
      );

      const presetsByPolicy = {};
      result.rows.forEach(row => {
        const mergedSignals = mergePresetSignals(
          normalizeSignalConfig(row.signals),
          normalizeSignalConfig(row.custom_signals)
        );

        if (!presetsByPolicy[row.policy_id]) {
          presetsByPolicy[row.policy_id] = [];
        }
        presetsByPolicy[row.policy_id].push({
          preset_id: row.preset_id,
          preset_name: row.preset_name,
          signals: mergedSignals
        });
      });

      return presetsByPolicy;
    } catch (error) {
      logger.error('Failed to load policy presets for clarification', { error: error.message });
      return {};
    }
  }

  buildLanguageQuestion(metadata, candidates, presetsByPolicy, extras = {}) {
    const originalLanguage = (metadata.original_language || '').toLowerCase();
    const languageRelevant = !originalLanguage || originalLanguage !== 'en';
    if (!languageRelevant) return null;

    // Note: hard language conflicts (policyEngine's languageConflicts) are handled
    // upstream in build() via buildLanguageConflictQuestion() before we reach here.

    const languageCandidates = candidates
      .map(candidate => ({
        ...candidate,
        languages: this.getLanguagesForPolicy(presetsByPolicy[candidate.policy_id] || [])
      }))
      .filter(candidate => candidate.languages.length > 0);

    if (languageCandidates.length === 0) {
      return null;
    }

    // ── Case A: Unknown language with multiple language-preset candidates ───────
    if (!originalLanguage && languageCandidates.length > 1) {
      const options = languageCandidates.slice(0, 3).map(candidate => {
        const code = candidate.languages[0];
        const label = this.formatLanguage(code);
        return this.toOption(`${label} → ${candidate.library.name}`, candidate.library);
      });

      return this.buildQuestionPayload(metadata, {
        problem_summary: 'Language needed',
        why_uncertain: 'Language presets are active, but the original language is missing.',
        question: 'Which language best fits this content?',
        options,
        candidates: languageCandidates,
        extras
      });
    }

    const targetLanguage = originalLanguage || languageCandidates[0].languages[0];
    const targetCandidate = languageCandidates.find(candidate => candidate.languages.includes(targetLanguage));

    // ── Case B: Known language but no candidate's presets match it ──────────────
    // The old code fell back to languageCandidates[0] here and asked an incoherent
    // "Is this Chinese? Yes → Anime Movies (which requires Japanese)" question.
    // Instead, surface a direct library selection with clear context.
    if (!targetCandidate && originalLanguage) {
      const mismatchedLib = languageCandidates[0];
      const mismatchedLangLabel = this.formatLanguage(mismatchedLib.languages[0]);
      const itemLangLabel = this.formatLanguage(originalLanguage);
      const options = candidates.slice(0, 3).map(c => this.toOption(c.library.name, c.library));

      return this.buildQuestionPayload(metadata, {
        problem_summary: 'Language mismatch',
        why_uncertain: `This is ${itemLangLabel} content, but "${mismatchedLib.library.name}" is configured for ${mismatchedLangLabel} content.`,
        question: `This is ${itemLangLabel} content. Which library should it go to?`,
        options,
        candidates,
        extras,
      });
    }

    // ── Case C: Known language matches a candidate; standard Yes/No confirm ─────
    const resolvedTargetCandidate = targetCandidate || languageCandidates[0];
    const fallbackCandidate = candidates.find(candidate => candidate.library_id !== resolvedTargetCandidate.library_id);

    if (!fallbackCandidate) {
      return this.buildLibrarySelectionQuestion(metadata, candidates.map(c => c.library), {
        reason: 'Language preset available but no alternative library found',
        candidates,
        ragContext: extras.ragContext,
        aiResult: extras.aiResult,
        policyResult: extras.policyResult
      });
    }

    const languageLabel = this.formatLanguage(targetLanguage);
    const question = `Is this primarily ${languageLabel} language content?`;

    return this.buildQuestionPayload(metadata, {
      problem_summary: 'Language clarification',
      why_uncertain: `Language presets favor ${resolvedTargetCandidate.library.name}, but we need confirmation.`,
      question,
      options: [
        this.toOption(`Yes → ${resolvedTargetCandidate.library.name}`, resolvedTargetCandidate.library),
        this.toOption(`No → ${fallbackCandidate.library.name}`, fallbackCandidate.library)
      ],
      candidates,
      extras: {
        ...extras,
        question_anchor_library: resolvedTargetCandidate.library,
        question_anchor_reason: resolvedTargetCandidate.library_id === candidates?.[0]?.library_id
          ? 'primary_candidate'
          : 'binary_verify_flow',
      }
    });
  }

  buildCandidateQuestion(metadata, candidates, presetsByPolicy, extras = {}) {
    const top = candidates[0];
    const second = candidates[1];
    const scoreDiff = top && second && top.score != null && second.score != null
      ? Math.abs(top.score - second.score)
      : null;
    const isClose = scoreDiff !== null && scoreDiff <= 10;

    const signalTypes = this.collectSignalTypes(presetsByPolicy, candidates);
    const signalLabel = signalTypes.length > 0 ? `Signals involved: ${signalTypes.join(', ')}.` : null;
    const uncertainty = isClose
      ? `Top candidates are close (${top.score}% vs ${second.score}%).`
      : 'Policy signals are weak or conflicting.';

    const whyUncertain = [uncertainty, signalLabel].filter(Boolean).join(' ');

    const question = second
      ? `Which library fits best: ${top.library.name} or ${second.library.name}?`
      : `Which library should "${metadata.title || 'this item'}" go to?`;

    const options = candidates
      .map(candidate => candidate.library)
      .filter(Boolean)
      .map(lib => this.toOption(lib.name, lib));

    return this.buildQuestionPayload(metadata, {
      problem_summary: isClose ? 'Conflicting signals' : 'Low confidence',
      why_uncertain: whyUncertain,
      question,
      options,
      candidates,
      extras
    });
  }

  buildLibrarySelectionQuestion(metadata, libraries, { reason, candidates, ragContext, aiResult, policyResult } = {}) {
    const options = (libraries || []).slice(0, 3).map(lib => this.toOption(lib.name, lib));
    if (options.length === 0) {
      return null;
    }

    return this.buildQuestionPayload(metadata, {
      problem_summary: 'Manual selection needed',
      why_uncertain: reason || 'No policy presets are attached to inform a targeted question.',
      question: `Which library should "${metadata.title || 'this item'}" go to?`,
      options,
      candidates: candidates || [],
      extras: { ragContext, aiResult, policyResult }
    });
  }

  buildQuestionPayload(metadata, { problem_summary, why_uncertain, question, options, candidates, extras = {} }) {
    const topCandidate = (candidates || [])[0];
    const primaryCandidateLibraryId = topCandidate?.library_id ?? topCandidate?.library?.id ?? options?.[0]?.library_id ?? null;
    const primaryCandidateLibraryName = topCandidate?.library_name ?? topCandidate?.library?.name ?? options?.[0]?.library_name ?? null;
    const questionAnchorLibrary = extras.question_anchor_library
      || topCandidate?.library
      || (primaryCandidateLibraryId ? { id: primaryCandidateLibraryId, name: primaryCandidateLibraryName } : null);
    const questionAnchorReason = extras.question_anchor_reason
      || (questionAnchorLibrary?.id === primaryCandidateLibraryId ? 'primary_candidate' : 'manual_review_required');
    const policyScores = topCandidate?.scores || null;
    const policyWeights = topCandidate?.weights || null;
    const ragSummary = extras.ragContext?.similarItems
      ? extras.ragContext.similarItems.map(item => ({
        title: item.title,
        library: item.libraryName || item.library_name,
        similarity: item.similarity
      }))
      : null;
    const aiRationale = extras.aiResult?.reason || null;
    const tags = {
      genres: normalizeMetadataList(metadata.genres),
      keywords: normalizeMetadataList(metadata.keywords).slice(0, 10)
    };

    if (
      primaryCandidateLibraryId != null &&
      options?.[0]?.library_id != null &&
      primaryCandidateLibraryId !== options[0].library_id &&
      questionAnchorReason === 'primary_candidate'
    ) {
      logger.warn('Policy question option order diverges from primary candidate', {
        title: metadata?.title,
        primaryCandidateLibraryId,
        primaryCandidateLibraryName,
        firstOptionLibraryId: options[0].library_id,
        firstOptionLibraryName: options[0].library_name
      });
    }

    return {
      type: 'policy',
      problem_summary,
      why_uncertain,
      question,
      options,
      meta: {
        candidates: (candidates || []).map(candidate => ({
          library_id: candidate.library_id,
          library_name: candidate.library_name,
          score: candidate.score,
          policy_id: candidate.policy_id,
          policy_name: candidate.policy_name
        })),
        policy_scores: policyScores,
        policy_weights: policyWeights,
        rag_summary: ragSummary,
        ai_rationale: aiRationale,
        primary_candidate_library_id: primaryCandidateLibraryId,
        primary_candidate_library_name: primaryCandidateLibraryName,
        question_anchor_library_id: questionAnchorLibrary?.id ?? null,
        question_anchor_library_name: questionAnchorLibrary?.name ?? null,
        question_anchor_reason: questionAnchorReason,
        tags
      },
      generated_at: new Date().toISOString()
    };
  }

  getLanguagesForPolicy(presets) {
    const languages = new Set();
    (presets || []).forEach(preset => {
      const languageSignals = preset.signals?.language || {};
      ['require_any', 'prefer', 'exclude'].forEach(key => {
        const values = languageSignals[key] || [];
        values.forEach(code => languages.add(code.toLowerCase()));
      });
    });
    return Array.from(languages);
  }

  collectSignalTypes(presetsByPolicy, candidates) {
    const types = new Set();
    candidates.forEach(candidate => {
      const presets = presetsByPolicy[candidate.policy_id] || [];
      presets.forEach(preset => {
        Object.entries(preset.signals || {}).forEach(([signalType, config]) => {
          if (signalType === 'media_type') return;
          if (config && Object.keys(config).length > 0) {
            types.add(signalType);
          }
        });
      });
    });
    return Array.from(types);
  }

  toOption(label, library) {
    const safeLabel = label?.toString() || 'Option';
    const value = safeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 30);

    return {
      label: safeLabel,
      value,
      library_id: library?.id || null,
      library_name: library?.name || null
    };
  }

  formatLanguage(code) {
    if (!code) return 'non-English';
    return LANGUAGE_LABELS[code.toLowerCase()] || code.toUpperCase();
  }

  formatLanguageList(codes) {
    const uniqueCodes = Array.from(new Set((codes || []).filter(Boolean).map(code => code.toLowerCase())));
    if (uniqueCodes.length === 0) {
      return 'non-English';
    }
    if (uniqueCodes.length === 1) {
      return this.formatLanguage(uniqueCodes[0]);
    }
    return uniqueCodes.map(code => this.formatLanguage(code)).join('/');
  }
}

module.exports = new PolicyQuestionBuilder();
