import { createLogger } from '../utils/logger.mjs';
import {
    calculateNetConfidence as _calculateNetConfidence,
    detectIntraLibraryConflict as _detectIntraLibraryConflict,
    canApplyLearning as _canApplyLearning,
    recordLearningEvent as _recordLearningEvent,
} from './autoLearningConfidence.mjs';
import {
    addGenreToPrefer as _addGenreToPrefer,
    addKeywordToPrefer as _addKeywordToPrefer,
    addStudioToPrefer as _addStudioToPrefer,
} from './autoLearningPreferenceWriters.mjs';
import {
    createSettingsState,
    clearSettingsState as _clearSettingsState,
    getLearningSettings as _getLearningSettings,
    getLearnedPreferences as _getLearnedPreferences,
    revertPreference as _revertPreference,
} from './autoLearningQueries.mjs';

const logger = createLogger('AutoLearning');

const DEFAULT_THRESHOLDS = {
    genreLearnThreshold: 3,
    keywordLearnThreshold: 5,
    studioLearnThreshold: 2,
    minConfidenceRate: 0.75,
    maxLearnsPerUserPerDay: 50,
    maxLearnsPerLibraryPerHour: 20,
    learningLookbackDays: 30
};

class AutoLearningService {
    constructor() {
        this._settingsState = createSettingsState();
    }

    clearCache() {
        _clearSettingsState(this._settingsState);
    }

    async getLearningSettings() {
        return _getLearningSettings(this._settingsState, DEFAULT_THRESHOLDS);
    }

    async learnFromFeedback(feedbackData) {
        try {
            const {
                tmdbId,
                libraryId,
                genres = [],
                keywords = [],
                studio,
                wasCorrection = false,
                userId
            } = feedbackData;

            logger.info('Learning from feedback', {
                tmdbId,
                libraryId,
                wasCorrection,
                genreCount: genres.length,
                keywordCount: keywords.length
            });

            const rateLimitCheck = await this.canApplyLearning(userId, libraryId);
            if (!rateLimitCheck.allowed) {
                logger.warn('Rate limit exceeded', {
                    userId,
                    libraryId,
                    reason: rateLimitCheck.reason
                });
                return {
                    learned: false,
                    reason: 'rate_limit',
                    details: rateLimitCheck.reason
                };
            }

            const learnedPreferences = [];

            for (const genre of genres.slice(0, 3)) {
                const result = await this.learnGenrePreference(libraryId, genre, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'genre', value: genre });
                }
            }

            for (const keyword of keywords.slice(0, 5)) {
                const result = await this.learnKeywordPreference(libraryId, keyword, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'keyword', value: keyword });
                }
            }

            if (studio) {
                const result = await this.learnStudioPreference(libraryId, studio, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'studio', value: studio });
                }
            }

            if (learnedPreferences.length > 0) {
                await this.recordLearningEvent(userId, libraryId);
            }

            logger.info('Learning completed', {
                tmdbId,
                libraryId,
                learnedCount: learnedPreferences.length,
                learned: learnedPreferences
            });

            return {
                learned: learnedPreferences.length > 0,
                preferences: learnedPreferences,
                count: learnedPreferences.length
            };
        } catch (error) {
            logger.error('Failed to learn from feedback', {
                error: error.message,
                stack: error.stack
            });
            return {
                learned: false,
                error: error.message
            };
        }
    }

    async learnGenrePreference(libraryId, genre, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, genre, 'genre');

            logger.debug('Genre confidence calculated', {
                libraryId,
                genre,
                confirmCount: confidence.confirmCount,
                rejectCount: confidence.rejectCount,
                netConfidence: confidence.netConfidence,
                confidenceRate: confidence.confidenceRate,
                shouldApply: confidence.shouldApply
            });

            if (!confidence.shouldApply) {
                return { learned: false, reason: 'insufficient_confidence' };
            }

            const conflict = await this.detectIntraLibraryConflict(libraryId, genre, 'genre_prefer');
            if (conflict.conflict) {
                logger.warn('Genre learning blocked due to conflict', {
                    libraryId,
                    genre,
                    conflictType: conflict.type
                });
                return { learned: false, reason: 'conflict_detected' };
            }

            await this.addGenreToPrefer(libraryId, genre, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn genre preference', {
                error: error.message,
                libraryId,
                genre
            });
            return { learned: false, error: error.message };
        }
    }

    async learnKeywordPreference(libraryId, keyword, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, keyword, 'keyword');

            const settings = await this.getLearningSettings();
            if (confidence.confirmCount < settings.keywordLearnThreshold) {
                return { learned: false, reason: 'insufficient_confirmations' };
            }

            if (confidence.confidenceRate < settings.minConfidenceRate) {
                return { learned: false, reason: 'low_confidence_rate' };
            }

            await this.addKeywordToPrefer(libraryId, keyword, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn keyword preference', {
                error: error.message,
                libraryId,
                keyword
            });
            return { learned: false, error: error.message };
        }
    }

    async learnStudioPreference(libraryId, studio, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, studio, 'studio');

            const settings = await this.getLearningSettings();
            if (confidence.confirmCount < settings.studioLearnThreshold) {
                return { learned: false, reason: 'insufficient_confirmations' };
            }

            if (confidence.confidenceRate < settings.minConfidenceRate) {
                return { learned: false, reason: 'low_confidence_rate' };
            }

            await this.addStudioToPrefer(libraryId, studio, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn studio preference', {
                error: error.message,
                libraryId,
                studio
            });
            return { learned: false, error: error.message };
        }
    }

    async addGenreToPrefer(libraryId, genre, confirmCount, userId) {
        return _addGenreToPrefer(libraryId, genre, confirmCount, userId);
    }

    async addKeywordToPrefer(libraryId, keyword, confirmCount, userId) {
        return _addKeywordToPrefer(libraryId, keyword, confirmCount, userId);
    }

    async addStudioToPrefer(libraryId, studio, confirmCount, userId) {
        return _addStudioToPrefer(libraryId, studio, confirmCount, userId);
    }

    async calculateNetConfidence(libraryId, value, type) {
        return _calculateNetConfidence(libraryId, value, type, () => this.getLearningSettings());
    }

    async detectIntraLibraryConflict(libraryId, value, preferenceType) {
        return _detectIntraLibraryConflict(libraryId, value, preferenceType);
    }

    async canApplyLearning(userId, libraryId) {
        return _canApplyLearning(userId, libraryId, () => this.getLearningSettings());
    }

    async recordLearningEvent(userId, libraryId) {
        return _recordLearningEvent(userId, libraryId);
    }

    async getLearnedPreferences(libraryId, options = {}) {
        return _getLearnedPreferences(libraryId, options);
    }

    async revertPreference(preferenceId, userId, reason) {
        return _revertPreference(preferenceId, userId, reason);
    }
}

export const autoLearningService = new AutoLearningService();
