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
import {
    formatLanguage as _formatLanguage,
    formatLanguageList as _formatLanguageList,
    toOption as _toOption,
    buildQuestionPayload as _buildQuestionPayload,
    getLanguagesForPolicy as _getLanguagesForPolicy,
    collectSignalTypes as _collectSignalTypes
} from './policyQuestionBuilderUtils.mjs';
import {
    filterLibrariesByMediaType as _filterLibrariesByMediaType,
    buildCandidates as _buildCandidates,
    getPresetsByPolicy as _getPresetsByPolicy
} from './policyQuestionBuilderQueries.mjs';

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
        const filteredLibraries = _filterLibrariesByMediaType(libraries, mediaType);
        const languageConflicts = policyResult?.languageConflicts || [];

        const candidates = _buildCandidates(policyResult, filteredLibraries, suggestedLibrary, maxOptions);
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
        return _filterLibrariesByMediaType(libraries, mediaType);
    }

    buildCandidates(policyResult, libraries, suggestedLibrary, maxOptions) {
        return _buildCandidates(policyResult, libraries, suggestedLibrary, maxOptions);
    }

    async getPresetsByPolicy(policyIds) {
        return _getPresetsByPolicy(policyIds, {
            db: this.db,
            mergePresetSignalsFn: (a, b) => this.mergePresetSignals(a, b),
            normalizeSignalConfigFn: (s) => this.normalizeSignalConfig(s),
        });
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
        return _buildQuestionPayload(metadata, payload, { normalizeMetadataList, logger });
    }

    getLanguagesForPolicy(presets) {
        return _getLanguagesForPolicy(presets);
    }

    collectSignalTypes(presetsByPolicy, candidates) {
        return _collectSignalTypes(presetsByPolicy, candidates);
    }

    toOption(label, library) {
        return _toOption(label, library);
    }

    formatLanguage(code) {
        return _formatLanguage(code);
    }

    formatLanguageList(codes) {
        return _formatLanguageList(codes);
    }
}

export const policyQuestionBuilder = new PolicyQuestionBuilder();
