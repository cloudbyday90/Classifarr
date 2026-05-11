/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as db from '../config/database.mjs';
import { tmdbService } from './tmdb.mjs';
import { createLogger } from '../utils/logger.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';

const defaultLogger = createLogger('SignalCollector');

export const SIGNAL_TYPES = {
    PATTERN_STUDIO: 'pattern_studio',
    PATTERN_FRANCHISE: 'pattern_franchise',
    PATTERN_GENRE: 'pattern_genre',
    PATTERN_CERTIFICATION: 'pattern_certification',
    SOURCE_LIBRARY: 'source_library',
    MANUAL_CORRECTION: 'manual_correction',
    CUSTOM_RULE: 'custom_rule',
    EXISTING_MEDIA: 'existing_media',
    CONTENT_ANALYSIS: 'content_analysis',
    EXACT_MATCH: 'exact_match',
    COLLECTION_MATCH: 'collection_match',
    KEYWORD_MATCH: 'keyword_match',
    GENRE_MATCH: 'genre_match',
    SEMANTIC_SIMILARITY: 'semantic_similarity',
    PROFILE_SCORE: 'profile_score',
};

export const PATTERN_SIGNAL_TYPES = [
    SIGNAL_TYPES.PATTERN_STUDIO,
    SIGNAL_TYPES.PATTERN_FRANCHISE,
    SIGNAL_TYPES.PATTERN_GENRE,
    SIGNAL_TYPES.PATTERN_CERTIFICATION
];

export class SignalCollector {
    constructor(deps = {}) {
        this.db = deps.db || db;
        this.tmdbService = deps.tmdbService || tmdbService;
        this.libraryProfileService = deps.libraryProfileService || libraryProfileService;
        this.logger = deps.logger || defaultLogger;
        this.signals = [];
    }

    reset() {
        this.signals = [];
    }

    addSignal(type, data, rawScore = 0, library = null) {
        this.signals.push({
            type,
            data,
            rawScore,
            library,
            timestamp: new Date().toISOString(),
        });

        this.logger.debug('Signal collected', {
            type,
            rawScore,
            library: library?.name || null,
        });
    }

    getSignals() {
        return this.signals;
    }

    getSignalsByType(type) {
        return this.signals.filter(s => s.type === type);
    }

    getPatternSignals() {
        return this.signals.filter(s => PATTERN_SIGNAL_TYPES.includes(s.type));
    }

    hasSignal(type) {
        return this.signals.some(s => s.type === type);
    }

    getHighestScoringSignal() {
        if (this.signals.length === 0) return null;
        return this.signals.reduce((max, s) => s.rawScore > max.rawScore ? s : max);
    }

    getSignalsByLibrary() {
        const grouped = {};
        for (const signal of this.signals) {
            if (signal.library) {
                const libId = signal.library.id;
                if (!grouped[libId]) {
                    grouped[libId] = {
                        library: signal.library,
                        signals: [],
                        totalScore: 0,
                    };
                }
                grouped[libId].signals.push(signal);
                grouped[libId].totalScore += signal.rawScore;
            }
        }
        return grouped;
    }

    async checkFranchiseMembership(tmdbId, mediaType) {
        try {
            if (!tmdbId || mediaType !== 'movie') {
                return null;
            }

            const details = await this.tmdbService.getMovieDetails(tmdbId);

            if (details.belongs_to_collection) {
                const collection = details.belongs_to_collection;
                this.logger.debug('Franchise detected', {
                    tmdbId,
                    collectionId: collection.id,
                    collectionName: collection.name,
                });

                return {
                    collectionId: collection.id,
                    collectionName: collection.name,
                    posterPath: collection.poster_path,
                    backdropPath: collection.backdrop_path,
                };
            }

            return null;
        } catch (error) {
            this.logger.warn('Failed to check franchise membership', {
                tmdbId,
                error: error.message,
            });
            return null;
        }
    }

    async findRelatedClassifiedItems(collectionId) {
        try {
            if (!collectionId) return [];

            const result = await this.db.query(
                `SELECT 
          ch.tmdb_id, 
          ch.title, 
          ch.library_id, 
          ch.library_name,
          ch.confidence,
          ch.method,
          ch.created_at
        FROM classification_history ch
        WHERE ch.collection_id = $1
          AND ch.confidence >= 80
        ORDER BY ch.created_at DESC
        LIMIT 10`,
                [collectionId]
            );

            if (result.rows.length > 0) {
                this.logger.debug('Found related classified items', {
                    collectionId,
                    count: result.rows.length,
                });
            }

            return result.rows;
        } catch (error) {
            this.logger.debug('Could not query related items', { error: error.message });
            return [];
        }
    }

    resolveDetectorMethod(detectors, methodName, serviceName = null, serviceMethodName = methodName) {
        if (typeof detectors[methodName] === 'function') {
            return detectors[methodName];
        }

        const service = serviceName ? detectors[serviceName] : null;
        if (service && typeof service[serviceMethodName] === 'function') {
            return service[serviceMethodName].bind(service);
        }

        return null;
    }

    resolveExactMatchDetector(detectors) {
        if (typeof detectors.checkExactMatch === 'function') {
            return detectors.checkExactMatch;
        }

        if (typeof detectors.classificationEvidenceService?.findExactMatch === 'function') {
            return async (tmdbId, mediaType) => {
                const match = await detectors.classificationEvidenceService.findExactMatch({ tmdbId, mediaType });
                return match ? { library_id: match.libraryId, confidence: match.confidence } : null;
            };
        }

        return null;
    }

    async collectAll(metadata, libraries, detectors) {
        this.reset();
        const checkLearnedCorrections = this.resolveDetectorMethod(
            detectors,
            'checkLearnedCorrections',
            'classificationLearnedCorrectionsService',
        );
        const checkLibraryRules = this.resolveDetectorMethod(
            detectors,
            'checkLibraryRules',
            'libraryRulesService',
        );
        const findExistingMedia = this.resolveDetectorMethod(
            detectors,
            'findExistingMedia',
            'mediaSyncLibraryStateService',
        );
        const analyzeContent = this.resolveDetectorMethod(
            detectors,
            'analyzeContent',
            'contentTypeAnalyzer',
            'analyze',
        );
        const checkExactMatch = this.resolveExactMatchDetector(detectors);
        const matchRules = this.resolveDetectorMethod(detectors, 'matchRules');

        if (metadata.source_library_id) {
            const sourceLib = libraries.find(l => l.id === metadata.source_library_id);
            if (sourceLib) {
                this.addSignal(SIGNAL_TYPES.SOURCE_LIBRARY, {
                    sourceLibraryName: sourceLib.name,
                }, 100, sourceLib);
            }
        }

        if (checkLearnedCorrections) {
            const correction = await checkLearnedCorrections(metadata.tmdb_id, metadata.media_type);
            if (correction) {
                const correctedLib = libraries.find(l => l.id === correction.corrected_library_id);
                if (correctedLib) {
                    this.addSignal(SIGNAL_TYPES.MANUAL_CORRECTION, {
                        correctedBy: correction.corrected_by,
                        correctedAt: correction.created_at,
                    }, 100, correctedLib);
                }
            }
        }

        for (const library of libraries) {
            try {
                const profileScore = await this.libraryProfileService.getProfileScore(library.id, metadata);
                if (profileScore !== 50) {
                    this.addSignal(SIGNAL_TYPES.PROFILE_SCORE, {
                        library_id: library.id,
                        library_name: library.name,
                        profile_score: profileScore,
                        description: profileScore > 70 ? 'Strong match' :
                            profileScore > 55 ? 'Moderate match' :
                                profileScore < 30 ? 'Strong mismatch' :
                                    profileScore < 45 ? 'Moderate mismatch' : 'Weak signal'
                    }, profileScore, library);
                }
            } catch (err) {
                this.logger.debug('Could not get profile score', { libraryId: library.id, error: err.message });
            }
        }
        this.logger.debug('Profile scoring complete', { libraryCount: libraries.length });

        if (checkLibraryRules) {
            const ruleMatch = await checkLibraryRules(metadata, libraries);
            if (ruleMatch) {
                this.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {
                    matchedRule: ruleMatch.matchedRule,
                    isException: ruleMatch.isException,
                    reason: ruleMatch.reason,
                }, ruleMatch.isException ? 98 : 90, ruleMatch.library);
            }
        }

        if (findExistingMedia) {
            const existing = await findExistingMedia(metadata.tmdb_id, metadata.media_type);
            if (existing) {
                const existingLib = libraries.find(l => l.id === existing.library_id);
                if (existingLib) {
                    this.addSignal(SIGNAL_TYPES.EXISTING_MEDIA, {
                        libraryName: existing.library_name,
                    }, 100, existingLib);
                }
            }
        }

        if (analyzeContent) {
            const analysis = await analyzeContent(metadata);
            if (analysis?.bestMatch) {
                this.addSignal(SIGNAL_TYPES.CONTENT_ANALYSIS, {
                    contentType: analysis.bestMatch.type,
                    contentConfidence: analysis.bestMatch.confidence,
                    allMatches: analysis.matches,
                }, analysis.bestMatch.confidence, null);
                metadata.contentAnalysis = analysis;
            }
        }

        if (checkExactMatch) {
            const exactMatch = await checkExactMatch(metadata.tmdb_id, metadata.media_type);
            if (exactMatch) {
                const exactLib = libraries.find(l => l.id === exactMatch.library_id);
                if (exactLib) {
                    this.addSignal(SIGNAL_TYPES.EXACT_MATCH, {
                        previouslyConfirmed: true,
                    }, 100, exactLib);
                }
            }
        }

        const franchise = await this.checkFranchiseMembership(metadata.tmdb_id, metadata.media_type);
        if (franchise) {
            const relatedItems = await this.findRelatedClassifiedItems(franchise.collectionId);
            if (relatedItems.length > 0) {
                const libCounts = {};
                for (const item of relatedItems) {
                    libCounts[item.library_id] = (libCounts[item.library_id] || 0) + 1;
                }
                const mostCommonLibId = Object.entries(libCounts)
                    .sort((a, b) => b[1] - a[1])[0]?.[0];

                if (mostCommonLibId) {
                    const franchiseLib = libraries.find(l => l.id === parseInt(mostCommonLibId));
                    if (franchiseLib) {
                        this.addSignal(SIGNAL_TYPES.COLLECTION_MATCH, {
                            collectionName: franchise.collectionName,
                            collectionId: franchise.collectionId,
                            relatedItems: relatedItems.slice(0, 5),
                        }, 85, franchiseLib);
                    }
                }
            }
        }

        if (matchRules) {
            const legacyMatch = await matchRules(metadata, libraries);
            if (legacyMatch && legacyMatch.confidence >= 50) {
                this.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {
                    source: 'legacy',
                    reason: legacyMatch.reason,
                }, legacyMatch.confidence, legacyMatch.library);
            }
        }

        this.logger.info('Signal collection complete', {
            title: metadata.title,
            totalSignals: this.signals.length,
            signalTypes: [...new Set(this.signals.map(s => s.type))],
        });

        return this.signals;
    }

    toAIContext() {
        if (this.signals.length === 0) {
            return 'No classification signals detected.';
        }

        const lines = ['--- CLASSIFICATION SIGNALS ---'];

        for (const signal of this.signals) {
            let line = `• ${signal.type}: `;

            switch (signal.type) {
                case SIGNAL_TYPES.PATTERN_STUDIO:
                    line += `Studio pattern "${signal.data.pattern_value}" → "${signal.library?.name}" (${signal.rawScore}% confidence)`;
                    break;
                case SIGNAL_TYPES.PATTERN_FRANCHISE:
                    line += `Franchise pattern "${signal.data.pattern_value}" → "${signal.library?.name}" (${signal.rawScore}% confidence)`;
                    break;
                case SIGNAL_TYPES.PATTERN_GENRE:
                    line += `Genre pattern "${signal.data.pattern_value}" → "${signal.library?.name}" (${signal.rawScore}% confidence)`;
                    break;
                case SIGNAL_TYPES.PATTERN_CERTIFICATION:
                    line += `Certification pattern "${signal.data.pattern_value}" → "${signal.library?.name}" (${signal.rawScore}% confidence)`;
                    break;
                case SIGNAL_TYPES.SOURCE_LIBRARY:
                    line += `Already in "${signal.data.sourceLibraryName}" library (from Plex)`;
                    break;
                case SIGNAL_TYPES.MANUAL_CORRECTION:
                    line += `User previously corrected to "${signal.library?.name}"`;
                    break;
                case SIGNAL_TYPES.CUSTOM_RULE:
                    line += `Rule matched: ${signal.data.matchedRule || signal.data.reason} → "${signal.library?.name}"`;
                    break;
                case SIGNAL_TYPES.COLLECTION_MATCH:
                    line += `Part of "${signal.data.collectionName}" franchise - related items in "${signal.library?.name}"`;
                    break;
                case SIGNAL_TYPES.CONTENT_ANALYSIS:
                    line += `Content type: ${signal.data.contentType} (${signal.rawScore}% confidence)`;
                    break;
                case SIGNAL_TYPES.PROFILE_SCORE:
                    line += `Library profile "${signal.data.library_name}": ${signal.data.description} (score: ${signal.rawScore})`;
                    break;
                default:
                    line += `Score: ${signal.rawScore}% → ${signal.library?.name || 'N/A'}`;
            }

            lines.push(line);
        }

        return lines.join('\n');
    }
}
