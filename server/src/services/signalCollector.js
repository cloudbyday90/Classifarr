/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const tmdbService = require('./tmdb');
const { createLogger } = require('../utils/logger');
const patternSignalCollector = require('./patternSignalCollector');
const libraryProfileService = require('./libraryProfileService');

const logger = createLogger('SignalCollector');

/**
 * Signal types that can be collected during classification
 */
const SIGNAL_TYPES = {
    PATTERN_STUDIO: 'pattern_studio',            // Pattern from studio analysis
    PATTERN_FRANCHISE: 'pattern_franchise',      // Pattern from franchise analysis
    PATTERN_GENRE: 'pattern_genre',              // Pattern from genre combination
    PATTERN_CERTIFICATION: 'pattern_certification', // Pattern from certification
    SOURCE_LIBRARY: 'source_library',        // Item came from known Plex library
    MANUAL_CORRECTION: 'manual_correction',  // User previously corrected this TMDB ID
    CUSTOM_RULE: 'custom_rule',              // Custom rule matched
    EXISTING_MEDIA: 'existing_media',        // Already exists in media server
    CONTENT_ANALYSIS: 'content_analysis',    // Content type analysis result
    EXACT_MATCH: 'exact_match',              // Previously classified TMDB ID
    LEARNED_PATTERN: 'learned_pattern',      // Pattern from previous corrections
    COLLECTION_MATCH: 'collection_match',    // Part of same franchise/collection
    KEYWORD_MATCH: 'keyword_match',          // Keyword-based matching
    GENRE_MATCH: 'genre_match',              // Genre-based matching
    SEMANTIC_SIMILARITY: 'semantic_similarity', // RAG-based similar item matching
    PROFILE_SCORE: 'profile_score',          // v0.38.0+ Library profile match
};

/**
 * Pattern signal types for filtering
 */
const PATTERN_SIGNAL_TYPES = [
    SIGNAL_TYPES.PATTERN_STUDIO,
    SIGNAL_TYPES.PATTERN_FRANCHISE,
    SIGNAL_TYPES.PATTERN_GENRE,
    SIGNAL_TYPES.PATTERN_CERTIFICATION
];

/**
 * SignalCollector - Aggregates all classification signals without early exits
 * 
 * The new classification flow:
 * 1. Collect ALL signals (no early exits)
 * 2. Pass signals to ConfidenceCalculator for weighted scoring
 * 3. Pass to AI for verification/confirmation
 */
class SignalCollector {
    constructor() {
        this.signals = [];
    }

    /**
     * Reset signals for new classification
     */
    reset() {
        this.signals = [];
    }

    /**
     * Add a signal to the collection
     * @param {string} type - Signal type from SIGNAL_TYPES
     * @param {object} data - Signal data
     * @param {number} rawScore - Raw match score (0-100)
     * @param {object} library - Suggested library (if applicable)
     */
    addSignal(type, data, rawScore = 0, library = null) {
        this.signals.push({
            type,
            data,
            rawScore,
            library,
            timestamp: new Date().toISOString(),
        });

        logger.debug('Signal collected', {
            type,
            rawScore,
            library: library?.name || null,
        });
    }

    /**
     * Get all collected signals
     */
    getSignals() {
        return this.signals;
    }

    /**
     * Get signals by type
     */
    getSignalsByType(type) {
        return this.signals.filter(s => s.type === type);
    }

    /**
     * Get all pattern signals
     */
    getPatternSignals() {
        return this.signals.filter(s => PATTERN_SIGNAL_TYPES.includes(s.type));
    }

    /**
     * Check if any signal of given type exists
     */
    hasSignal(type) {
        return this.signals.some(s => s.type === type);
    }

    /**
     * Get the highest-scoring signal
     */
    getHighestScoringSignal() {
        if (this.signals.length === 0) return null;
        return this.signals.reduce((max, s) => s.rawScore > max.rawScore ? s : max);
    }

    /**
     * Get signals grouped by suggested library
     */
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

    /**
     * Check for franchise/collection membership via TMDb
     * @param {number} tmdbId - TMDb ID
     * @param {string} mediaType - 'movie' or 'tv'
     * @returns {object|null} Collection info if found
     */
    async checkFranchiseMembership(tmdbId, mediaType) {
        try {
            if (!tmdbId || mediaType !== 'movie') {
                // TMDb collections only apply to movies
                return null;
            }

            // Get movie details which includes belongs_to_collection
            const details = await tmdbService.getMovieDetails(tmdbId);

            if (details.belongs_to_collection) {
                const collection = details.belongs_to_collection;
                logger.debug('Franchise detected', {
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
            logger.warn('Failed to check franchise membership', {
                tmdbId,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Find previously classified items from the same collection/franchise
     * @param {number} collectionId - TMDb collection ID
     * @returns {Array} Previously classified items from same collection
     */
    async findRelatedClassifiedItems(collectionId) {
        try {
            if (!collectionId) return [];

            // Query classification history for items from same collection
            const result = await db.query(
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
                logger.debug('Found related classified items', {
                    collectionId,
                    count: result.rows.length,
                });
            }

            return result.rows;
        } catch (error) {
            // Column might not exist yet - that's ok
            logger.debug('Could not query related items', { error: error.message });
            return [];
        }
    }

    /**
     * Collect all signals for a given metadata object
     * This is the main entry point that aggregates all detection methods
     * 
     * @param {object} metadata - Media metadata
     * @param {Array} libraries - Available libraries
     * @param {object} detectors - Object containing detection functions
     * @returns {Array} All collected signals
     */
    async collectAll(metadata, libraries, detectors) {
        this.reset();

        // 1. Source Library Signal (Plex origin)
        if (metadata.source_library_id) {
            const sourceLib = libraries.find(l => l.id === metadata.source_library_id);
            if (sourceLib) {
                this.addSignal(SIGNAL_TYPES.SOURCE_LIBRARY, {
                    sourceLibraryName: sourceLib.name,
                }, 100, sourceLib);
            }
        }

        // 2. Manual Correction Signal (user previously corrected this TMDB ID)
        if (detectors.checkLearnedCorrections) {
            const correction = await detectors.checkLearnedCorrections(metadata.tmdb_id, metadata.media_type);
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

        // 3. Library Profile Signals (v0.38.0+ - replaces pattern signals)
        // Score item against each library's statistical profile
        for (const library of libraries) {
            try {
                const profileScore = await libraryProfileService.getProfileScore(library.id, metadata);
                // Only add signal if score deviates from neutral (50)
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
                // Profile may not exist yet - that's ok
                logger.debug('Could not get profile score', { libraryId: library.id, error: err.message });
            }
        }
        logger.debug('Profile scoring complete', { libraryCount: libraries.length });

        // 4. Custom Rule Signals (library rules)
        if (detectors.checkLibraryRules) {
            const ruleMatch = await detectors.checkLibraryRules(metadata, libraries);
            if (ruleMatch) {
                this.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {
                    matchedRule: ruleMatch.matchedRule,
                    isException: ruleMatch.isException,
                    reason: ruleMatch.reason,
                }, ruleMatch.isException ? 98 : 90, ruleMatch.library);
            }
        }

        // 5. Existing Media Signal
        if (detectors.findExistingMedia) {
            const existing = await detectors.findExistingMedia(metadata.tmdb_id, metadata.media_type);
            if (existing) {
                const existingLib = libraries.find(l => l.id === existing.library_id);
                if (existingLib) {
                    this.addSignal(SIGNAL_TYPES.EXISTING_MEDIA, {
                        libraryName: existing.library_name,
                    }, 100, existingLib);
                }
            }
        }

        // 6. Content Analysis Signal
        if (detectors.analyzeContent) {
            const analysis = await detectors.analyzeContent(metadata);
            if (analysis?.bestMatch) {
                this.addSignal(SIGNAL_TYPES.CONTENT_ANALYSIS, {
                    contentType: analysis.bestMatch.type,
                    contentConfidence: analysis.bestMatch.confidence,
                    allMatches: analysis.matches,
                }, analysis.bestMatch.confidence, null);
                // Store on metadata for later use
                metadata.contentAnalysis = analysis;
            }
        }

        // 7. Exact Match Signal
        if (detectors.checkExactMatch) {
            const exactMatch = await detectors.checkExactMatch(metadata.tmdb_id);
            if (exactMatch) {
                const exactLib = libraries.find(l => l.id === exactMatch.library_id);
                if (exactLib) {
                    this.addSignal(SIGNAL_TYPES.EXACT_MATCH, {
                        previouslyConfirmed: true,
                    }, 100, exactLib);
                }
            }
        }

        // 8. Learned Pattern Signal
        if (detectors.checkLearnedPatterns) {
            const pattern = await detectors.checkLearnedPatterns(metadata);
            if (pattern && pattern.confidence >= 50) { // Lower threshold - let AI decide
                const patternLib = libraries.find(l => l.id === pattern.library_id);
                if (patternLib) {
                    this.addSignal(SIGNAL_TYPES.LEARNED_PATTERN, {
                        patternType: pattern.pattern_type,
                        successRate: pattern.success_rate,
                    }, pattern.confidence, patternLib);
                }
            }
        }

        // 9. Collection/Franchise Signal
        const franchise = await this.checkFranchiseMembership(metadata.tmdb_id, metadata.media_type);
        if (franchise) {
            const relatedItems = await this.findRelatedClassifiedItems(franchise.collectionId);
            if (relatedItems.length > 0) {
                // Use the most common library from related items
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
                            relatedItems: relatedItems.slice(0, 5), // Include up to 5 examples
                        }, 85, franchiseLib); // High score for consistency
                    }
                }
            }
        }

        // 10. Legacy Rule Matching (matchRules)
        if (detectors.matchRules) {
            const legacyMatch = await detectors.matchRules(metadata, libraries);
            if (legacyMatch && legacyMatch.confidence >= 50) { // Lower threshold
                this.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {
                    source: 'legacy',
                    reason: legacyMatch.reason,
                }, legacyMatch.confidence, legacyMatch.library);
            }
        }

        logger.info('Signal collection complete', {
            title: metadata.title,
            totalSignals: this.signals.length,
            signalTypes: [...new Set(this.signals.map(s => s.type))],
        });

        return this.signals;
    }

    /**
     * Serialize signals for AI context
     */
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

module.exports = {
    SignalCollector,
    SIGNAL_TYPES,
    PATTERN_SIGNAL_TYPES,
};
