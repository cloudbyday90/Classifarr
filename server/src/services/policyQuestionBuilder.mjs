/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as dbModule from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { mergePresetSignals, normalizeSignalConfig } from '../utils/policySignals.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
    LANGUAGE_LABELS,
    buildLanguageConflictQuestion as _buildLanguageConflictQuestion,
    buildLanguageQuestion as _buildLanguageQuestion,
    buildCandidateQuestion as _buildCandidateQuestion,
    buildLibrarySelectionQuestion as _buildLibrarySelectionQuestion
} from './policyQuestionBuilderQuestions.mjs';

export { LANGUAGE_LABELS };

export class PolicyQuestionBuilder {
    constructor(deps = {}) {
        this._db = deps.db || null;
        this._logger = deps.logger || null;
        this._mergePresetSignals = deps.mergePresetSignals || null;
        this._normalizeSignalConfig = deps.normalizeSignalConfig || null;
        this._normalizeMetadataList = deps.normalizeMetadataList || null;
    }

    get db() {
        if (!this._db) {
            this._db = dbModule;
        }
        return this._db;
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('policyQuestionBuilder');
        }
        return this._logger;
    }

    get mergePresetSignals() {
        if (!this._mergePresetSignals) {
            this._mergePresetSignals = mergePresetSignals;
        }
        return this._mergePresetSignals;
    }

    get normalizeSignalConfig() {
        if (!this._normalizeSignalConfig) {
            this._normalizeSignalConfig = normalizeSignalConfig;
        }
        return this._normalizeSignalConfig;
    }

    get normalizeMetadataList() {
        if (!this._normalizeMetadataList) {
            this._normalizeMetadataList = normalizeMetadataList;
        }
        return this._normalizeMetadataList;
    }

    _questionDeps() {
        return {
            normalizeMetadataList: (v) => this.normalizeMetadataList(v),
            logger: this.logger,
            buildLibrarySelectionQuestion: (metadata, libraries, opts) =>
                this.buildLibrarySelectionQuestion(metadata, libraries, opts),
        };
    }

    async build({ metadata = {}, policyResult = null, libraries = [], suggestedLibrary = null, ragContext = null, aiResult = null, maxOptions = 3, relatedEvidenceSummary = null }) {
        const mediaType = metadata.media_type?.toLowerCase();
        const filteredLibraries = this.filterLibrariesByMediaType(libraries, mediaType);
        const languageConflicts = policyResult?.languageConflicts || [];

        const candidates = this.buildCandidates(policyResult, filteredLibraries, suggestedLibrary, maxOptions);
        if (candidates.length === 0) {
            return this.buildLibrarySelectionQuestion(metadata, filteredLibraries, {
                reason: 'No policy candidates available',
                ragContext,
                aiResult,
                policyResult,
                relatedEvidenceSummary,
            });
        }

        const originalLanguage = (metadata.original_language || '').toLowerCase();
        if (originalLanguage && languageConflicts.length > 0) {
            const conflictQuestion = this.buildLanguageConflictQuestion(
                metadata, candidates, languageConflicts, { ragContext, aiResult, policyResult, relatedEvidenceSummary }
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
                policyResult,
                relatedEvidenceSummary,
            });
        }

        const languageQuestion = this.buildLanguageQuestion(metadata, candidates, presetsByPolicy, {
            ragContext,
            aiResult,
            policyResult,
            languageConflicts,
            relatedEvidenceSummary,
        });
        if (languageQuestion) {
            return languageQuestion;
        }

        return this.buildCandidateQuestion(metadata, candidates, presetsByPolicy, {
            ragContext,
            aiResult,
            policyResult,
            relatedEvidenceSummary,
        });
    }

    buildLanguageConflictQuestion(metadata, candidates, languageConflicts, extras = {}) {
        return _buildLanguageConflictQuestion(metadata, candidates, languageConflicts, extras, this._questionDeps());
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
            const result = await this.db.query(
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
                const mergedSignals = this.mergePresetSignals(
                    this.normalizeSignalConfig(row.signals),
                    this.normalizeSignalConfig(row.custom_signals)
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
            this.logger.error('Failed to load policy presets for clarification', { error: error.message });
            return {};
        }
    }

    buildLanguageQuestion(metadata, candidates, presetsByPolicy, extras = {}) {
        return _buildLanguageQuestion(metadata, candidates, presetsByPolicy, extras, this._questionDeps());
    }

    buildCandidateQuestion(metadata, candidates, presetsByPolicy, extras = {}) {
        return _buildCandidateQuestion(metadata, candidates, presetsByPolicy, extras, this._questionDeps());
    }

    buildLibrarySelectionQuestion(metadata, libraries, opts = {}) {
        return _buildLibrarySelectionQuestion(metadata, libraries, opts, this._questionDeps());
    }

    buildQuestionPayload(metadata, payload) {
        const { normalizeMetadataList, logger } = this._questionDeps();
        const { problem_summary, why_uncertain, question, options, candidates, extras = {} } = payload;

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
        const relatedEvidenceSummary = extras.relatedEvidenceSummary ?? null;
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
                related_evidence_summary: relatedEvidenceSummary,
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

export const policyQuestionBuilder = new PolicyQuestionBuilder();
