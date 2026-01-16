/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
const patternSignalCollector = require('./patternSignalCollector');
const ragRetriever = require('./ragRetriever');
const libraryProfileService = require('./libraryProfileService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PolicyEngine');

// CRITICAL: 100% confidence is RESERVED for authoritative signals ONLY
// Formula scores are CAPPED at 95% maximum
const FORMULA_CONFIDENCE_CAP = 95;

// Default weight for RAG scoring when not explicitly configured
const DEFAULT_RAG_WEIGHT = 0.15;

/**
 * Policy-Driven Classification Engine
 * Evaluates media items against library policies with comprehensive signal scoring
 */
class PolicyEngine {
    /**
     * Main entry point: Evaluate an item against all active policies
     * @param {object} item - Media item with metadata (title, genres, keywords, etc.)
     * @returns {Promise<object>} Evaluation result with ranked libraries and action
     */
    async evaluateItem(item) {
        try {
            logger.info('Evaluating item against policies', { title: item.title });

            // 1. Check for 100% confidence authoritative signals first
            const authoritativeMatch = await this.checkAuthoritativeSignals(item);
            if (authoritativeMatch) {
                logger.info('Authoritative signal matched', {
                    title: item.title,
                    library: authoritativeMatch.library_name,
                    confidence: authoritativeMatch.confidence
                });
                return {
                    action: 'auto_classify',
                    library: authoritativeMatch,
                    confidence: authoritativeMatch.confidence,
                    method: authoritativeMatch.method,
                    ranked: [authoritativeMatch]
                };
            }

            // 2. Get all active policies
            const policies = await this.getActivePolicies();
            if (policies.length === 0) {
                logger.warn('No active policies found');
                return {
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                };
            }

            // 2.5. Filter policies by media_type (Bug #9 fix)
            const itemMediaType = item.media_type?.toLowerCase();
            const candidatePolicies = itemMediaType 
                ? policies.filter(p => p.library_media_type?.toLowerCase() === itemMediaType)
                : policies;

            logger.info('Filtered policies by media_type', {
                title: item.title,
                mediaType: itemMediaType,
                totalPolicies: policies.length,
                candidatePolicies: candidatePolicies.length,
                skippedPolicies: policies.length - candidatePolicies.length
            });

            if (candidatePolicies.length === 0) {
                logger.warn('No policies match item media_type', {
                    title: item.title,
                    mediaType: itemMediaType
                });
                return {
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                };
            }

            // 3. Pre-fetch RAG matches once for all policies (performance optimization)
            // Only call RAG if at least one policy actually uses it
            let ragCache = { matches: [], timestamp: Date.now() };
            const anyPolicyUsesRAG = candidatePolicies.some(p => p.trust_rag && (p.rag_weight || DEFAULT_RAG_WEIGHT) > 0);
            if (anyPolicyUsesRAG) {
                try {
                    const ragMatches = await ragRetriever.semanticSearch(item, 5);
                    ragCache = { matches: ragMatches, timestamp: Date.now() };
                } catch (error) {
                    logger.debug('Failed to pre-fetch RAG matches', { error: error.message });
                }
            }

            // 4. Evaluate each policy
            const evaluations = [];
            for (const policy of candidatePolicies) {
                const evaluation = await this.evaluatePolicy(policy, item, ragCache);
                if (evaluation.score > 0) {
                    evaluations.push(evaluation);
                }
            }

            if (evaluations.length === 0) {
                logger.info('No policies matched', { title: item.title });
                return {
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                };
            }

            // 4. Rank results
            const ranked = await this.rankResults(evaluations);

            // 5. Determine action based on top result
            const result = this.determineAction(ranked);

            logger.info('Policy evaluation complete', {
                title: item.title,
                action: result.action,
                topLibrary: result.library?.library_name,
                topScore: result.confidence
            });

            return result;

        } catch (error) {
            logger.error('Failed to evaluate item', {
                error: error.message,
                title: item?.title
            });
            throw error;
        }
    }

    /**
     * Check for 100% confidence authoritative signals
     * Currently: source library matching
     * @param {object} item - Media item
     * @returns {Promise<object|null>} Authoritative match or null
     */
    async checkAuthoritativeSignals(item) {
        try {
            // Check if item has a source library ID (from Plex/Emby/Jellyfin)
            if (!item.source_library_id) {
                return null;
            }

            // Find policy linked to this source library
            const result = await db.query(`
                SELECT 
                    lp.id as policy_id,
                    lp.library_id,
                    lp.name as policy_name,
                    l.id as library_id,
                    l.name as library_name
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.enabled = true
                AND lp.source_library_ids::jsonb ? $1
                ORDER BY lp.priority DESC
                LIMIT 1
            `, [item.source_library_id]);

            if (result.rows.length === 0) {
                return null;
            }

            const match = result.rows[0];
            return {
                library_id: match.library_id,
                library_name: match.library_name,
                policy_id: match.policy_id,
                policy_name: match.policy_name,
                confidence: 100,
                method: 'authoritative_source_library',
                reason: `Matched source library: ${item.source_library_name || item.source_library_id}`
            };

        } catch (error) {
            logger.error('Failed to check authoritative signals', { error: error.message });
            return null;
        }
    }

    /**
     * Get all active policies with their presets
     * @returns {Promise<Array>} Active policies
     */
    async getActivePolicies() {
        try {
            const result = await db.query(`
                SELECT 
                    lp.id,
                    lp.library_id,
                    lp.name,
                    lp.enabled,
                    lp.priority,
                    lp.auto_classify_threshold,
                    lp.prompt_threshold,
                    lp.trust_patterns,
                    lp.trust_rag,
                    lp.trust_history,
                    lp.preset_weight,
                    lp.profile_weight,
                    lp.pattern_weight,
                    lp.rag_weight,
                    lp.history_weight,
                    l.name as library_name,
                    l.media_type as library_media_type
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.enabled = true
                AND l.is_active = true
                ORDER BY lp.priority DESC, lp.sort_order ASC
            `);

            // For each policy, get its presets
            const policies = [];
            for (const policy of result.rows) {
                const presetsResult = await db.query(`
                    SELECT 
                        cp.id,
                        cp.key,
                        cp.name,
                        cp.signals,
                        pp.weight
                    FROM policy_presets pp
                    JOIN content_presets cp ON pp.preset_id = cp.id
                    WHERE pp.policy_id = $1
                `, [policy.id]);

                policy.presets = presetsResult.rows;
                policies.push(policy);
            }

            logger.debug('Retrieved active policies', { count: policies.length });
            return policies;

        } catch (error) {
            logger.error('Failed to get active policies', { error: error.message });
            return [];
        }
    }

    /**
     * Evaluate a single policy against an item
     * @param {object} policy - Policy with presets
     * @param {object} item - Media item
     * @param {object} ragCache - Cached RAG search results
     * @returns {Promise<object>} Evaluation result with score breakdown
     */
    async evaluatePolicy(policy, item, ragCache = { matches: [], timestamp: Date.now() }) {
        try {
            const scores = {
                preset: 0,
                pattern: 0,
                rag: 0,
                history: 0,
                profile: 0
            };

            // Score presets
            if (policy.presets && policy.presets.length > 0) {
                scores.preset = await this.scorePresets(policy.presets, item);
            }

            // Score profile (library statistical match)
            scores.profile = await this.scoreProfile(policy.library_id, item);

            // Score patterns (if trusted)
            if (policy.trust_patterns) {
                scores.pattern = await this.scorePatterns(policy.library_id, item);
            }

            // Score RAG (if trusted)
            if (policy.trust_rag) {
                scores.rag = await this.scoreRAG(policy.library_id, item, ragCache);
            }

            // Score history (if trusted)
            if (policy.trust_history) {
                scores.history = await this.scoreHistory(policy.library_id, item);
            }

            // Get weights (policy-specific or defaults)
            // Default weights as per v0.38.2 specification:
            // - Preset: 35% (primary signal source - defined rules)
            // - Profile: 25% (library statistical match - what's already there)
            // - Pattern: 15% (discovered associations)
            // - RAG: 15% (semantic similarity)
            // - History: 10% (learning from past decisions)
            const weights = {
                preset: policy.preset_weight ?? 0.35,
                profile: policy.profile_weight ?? 0.25,
                pattern: policy.pattern_weight ?? 0.15,
                rag: policy.rag_weight ?? 0.15,
                history: policy.history_weight ?? 0.10
            };

            // Calculate weighted score
            const weightedScore = 
                (scores.preset * weights.preset) +
                (scores.profile * weights.profile) +
                (scores.pattern * weights.pattern) +
                (scores.rag * weights.rag) +
                (scores.history * weights.history);

            // Normalize to 0-100 using only enabled scoring methods' weights
            const totalWeight =
                (policy.presets && policy.presets.length > 0 ? weights.preset : 0) +
                weights.profile + // Profile is always enabled
                (policy.trust_patterns ? weights.pattern : 0) +
                (policy.trust_rag ? weights.rag : 0) +
                (policy.trust_history ? weights.history : 0);
            const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;

            return {
                policy_id: policy.id,
                policy_name: policy.name,
                library_id: policy.library_id,
                library_name: policy.library_name,
                score: Math.round(finalScore * 100) / 100,
                scores,
                weights,
                auto_classify_threshold: policy.auto_classify_threshold,
                prompt_threshold: policy.prompt_threshold
            };

        } catch (error) {
            logger.error('Failed to evaluate policy', {
                error: error.message,
                policy: policy.name
            });
            return {
                policy_id: policy.id,
                policy_name: policy.name,
                library_id: policy.library_id,
                library_name: policy.library_name,
                score: 0,
                scores: { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
                weights: { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 }
            };
        }
    }

    /**
     * Score presets against item
     * @param {Array} presets - Array of presets with signals
     * @param {object} item - Media item
     * @returns {Promise<number>} Score 0-100
     */
    async scorePresets(presets, item) {
        try {
            if (!presets || presets.length === 0) {
                return 0;
            }

            let totalScore = 0;
            let totalWeight = 0;

            for (const preset of presets) {
                const presetWeight = preset.weight ?? 1.0;
                const signalScore = await this.evaluatePresetSignals(preset.signals, item);
                
                totalScore += signalScore * presetWeight;
                totalWeight += presetWeight;
            }

            const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;
            
            // Cap at FORMULA_CONFIDENCE_CAP (95) - 100% reserved for authoritative signals
            return Math.min(finalScore, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.error('Failed to score presets', { error: error.message });
            return 0;
        }
    }

    /**
     * Evaluate all signals in a preset
     * @param {object} signals - Preset signals configuration
     * @param {object} item - Media item
     * @returns {Promise<number>} Score 0-100
     */
    async evaluatePresetSignals(signals, item) {
        try {
            if (!signals) {
                return 0;
            }

            const scores = [];
            let totalWeight = 0;

            // Evaluate each signal type
            if (signals.certifications) {
                const score = this.scoreCertification(signals.certifications, item);
                const weight = signals.certifications.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.genres) {
                const score = this.scoreGenres(signals.genres, item);
                const weight = signals.genres.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.keywords) {
                const score = this.scoreKeywords(signals.keywords, item);
                const weight = signals.keywords.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.studios) {
                const score = this.scoreStudios(signals.studios, item);
                const weight = signals.studios.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.release_year) {
                const score = this.scoreReleaseYear(signals.release_year, item);
                const weight = signals.release_year.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.vote_average) {
                const score = this.scoreVoteAverage(signals.vote_average, item);
                const weight = signals.vote_average.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.runtime) {
                const score = this.scoreRuntime(signals.runtime, item);
                const weight = signals.runtime.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.language) {
                const score = this.scoreLanguage(signals.language, item);
                const weight = signals.language.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.media_type) {
                const score = this.scoreMediaType(signals.media_type, item);
                // Media type is binary - if it doesn't match, return 0 for entire preset
                if (score === 0) {
                    return 0;
                }
            }

            // Calculate weighted average
            if (totalWeight === 0) {
                return 0;
            }

            const totalScore = scores.reduce((sum, s) => sum + s, 0);
            return totalScore / totalWeight;

        } catch (error) {
            logger.error('Failed to evaluate preset signals', { error: error.message });
            return 0;
        }
    }

    /**
     * Score certification signals
     */
    scoreCertification(config, item) {
        try {
            const cert = item.certification?.toUpperCase();
            if (!cert) return 0;

            if (config.mode === 'include') {
                const included = (config.include || []).map(c => c.toUpperCase());
                return included.includes(cert) ? 100 : 0;
            }

            if (config.mode === 'exclude') {
                const excluded = (config.exclude || []).map(c => c.toUpperCase());
                return excluded.includes(cert) ? 0 : 100;
            }

            if (config.mode === 'max') {
                const certOrder = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];
                const maxCert = config.max?.toUpperCase();
                const maxIndex = certOrder.indexOf(maxCert);
                const itemIndex = certOrder.indexOf(cert);
                
                if (maxIndex === -1 || itemIndex === -1) return 50;
                return itemIndex <= maxIndex ? 100 : 0;
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score genre signals
     */
    scoreGenres(config, item) {
        try {
            const genresArray = typeof item.genres === 'string'
                ? JSON.parse(item.genres)
                : (item.genres || []);
            const genres = genresArray.map(g => g.toLowerCase());
            if (genres.length === 0) return 0;

            let score = 50; // Base score

            // require_all: all must be present (high weight)
            if (config.require_all && config.require_all.length > 0) {
                const allPresent = config.require_all.every(g => 
                    genres.includes(g.toLowerCase())
                );
                if (!allPresent) return 0;
                score = 100;
            }

            // require_any: at least one must be present
            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(g => 
                    genres.includes(g.toLowerCase())
                );
                if (!anyPresent) return 0;
                score = Math.max(score, 80);
            }

            // prefer: boost score for matches
            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(g => 
                    genres.includes(g.toLowerCase())
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            // exclude: fail if any excluded genre present
            if (config.exclude && config.exclude.length > 0) {
                const hasExcluded = config.exclude.some(g => 
                    genres.includes(g.toLowerCase())
                );
                if (hasExcluded) return 0;
            }

            return score;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score keyword signals
     */
    scoreKeywords(config, item) {
        try {
            let keywordsArray;
            if (typeof item.keywords === 'string') {
                try {
                    keywordsArray = JSON.parse(item.keywords);
                } catch (e) {
                    keywordsArray = [];
                }
            } else {
                keywordsArray = item.keywords || [];
            }
            const keywords = Array.isArray(keywordsArray)
                ? keywordsArray.map(k => (typeof k === 'string' ? k.toLowerCase() : ''))
                : [];
            const overview = (item.overview || '').toLowerCase();
            const title = (item.title || '').toLowerCase();
            
            const allText = [...keywords, overview, title].join(' ');

            let score = 50;

            // require_any
            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(k => 
                    allText.includes(k.toLowerCase())
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            // prefer
            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(k => 
                    allText.includes(k.toLowerCase())
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            // exclude
            if (config.exclude && config.exclude.length > 0) {
                const hasExcluded = config.exclude.some(k => 
                    allText.includes(k.toLowerCase())
                );
                if (hasExcluded) return 0;
            }

            return score;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score studio signals
     */
    scoreStudios(config, item) {
        try {
            const studiosArray =
                typeof item?.studios === 'string'
                    ? JSON.parse(item.studios)
                    : typeof item?.production_companies === 'string'
                        ? JSON.parse(item.production_companies)
                        : (item.studios || item.production_companies || []);

            const studios = studiosArray
                .map(s => (typeof s === 'string' ? s : s && s.name))
                .filter(Boolean)
                .map(s => s.toLowerCase());

            if (studios.length === 0) return 50; // Neutral if no studio data

            let score = 50;

            // require_any
            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(s => 
                    studios.some(studio => studio.includes(s.toLowerCase()))
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            // prefer
            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(s => 
                    studios.some(studio => studio.includes(s.toLowerCase()))
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            return score;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score release year signals
     */
    scoreReleaseYear(config, item) {
        try {
            const year = parseInt(item.year);
            if (!year || isNaN(year)) return 50;

            const min = config.min;
            const max = config.max;

            if (min && year < min) return 0;
            if (max && year > max) return 0;

            // Within range
            if (min && max) {
                // Full score if within range
                return 100;
            } else if (min || max) {
                // Partial score if only one bound
                return 80;
            }

            return 50;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score vote average signals
     */
    scoreVoteAverage(config, item) {
        try {
            const rating = parseFloat(item.rating || item.vote_average);
            if (!rating || isNaN(rating)) return 50;

            const min = config.min;
            const max = config.max;

            if (min && rating < min) return 0;
            if (max && rating > max) return 0;

            // Within range
            if (min && max) {
                return 100;
            } else if (min || max) {
                return 80;
            }

            return 50;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score runtime signals
     */
    scoreRuntime(config, item) {
        try {
            const runtime = parseInt(item.runtime);
            if (!runtime || isNaN(runtime)) return 50;

            const min = config.min_minutes;
            const max = config.max_minutes;

            if (min && runtime < min) return 0;
            if (max && runtime > max) return 0;

            if (min && max) {
                return 100;
            } else if (min || max) {
                return 80;
            }

            return 50;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score language signals
     */
    scoreLanguage(config, item) {
        try {
            const lang = (item.original_language || '').toLowerCase();
            if (!lang) return 50;

            let score = 50;

            // require_any
            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(l => 
                    l.toLowerCase() === lang
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            // prefer
            if (config.prefer && config.prefer.length > 0) {
                const isPreferred = config.prefer.some(l => 
                    l.toLowerCase() === lang
                );
                if (isPreferred) {
                    score = Math.max(score, 90);
                }
            }

            // exclude
            if (config.exclude && config.exclude.length > 0) {
                const isExcluded = config.exclude.some(l => 
                    l.toLowerCase() === lang
                );
                if (isExcluded) return 0;
            }

            return score;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score media type signals
     */
    scoreMediaType(config, item) {
        try {
            const mediaType = item.media_type?.toLowerCase();
            if (!mediaType) return 50;

            const included = (config.include || []).map(t => t.toLowerCase());
            return included.includes(mediaType) ? 100 : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Score patterns from discovered_patterns table
     */
    async scorePatterns(libraryId, item) {
        try {
            const signals = await patternSignalCollector.collectSignals(item, 0);
            
            if (!signals || signals.length === 0) {
                return 0;
            }

            // Find patterns matching this library
            const librarySignals = signals.filter(s => s.library?.id === libraryId);
            
            if (librarySignals.length === 0) {
                return 0;
            }

            // Return highest confidence, capped at FORMULA_CONFIDENCE_CAP
            const topSignal = librarySignals[0];
            return Math.min(topSignal.confidence, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score patterns', { error: error.message });
            return 0;
        }
    }

    /**
     * Score RAG/embedding similarity
     * @param {number} libraryId - Library ID to score for
     * @param {object} item - Media item
     * @param {object} ragCache - Cached RAG search results
     * @returns {Promise<number>} RAG similarity score (0-95)
     */
    async scoreRAG(libraryId, item, ragCache = { matches: [], timestamp: Date.now() }) {
        try {
            // Use cached RAG results
            const matches = ragCache?.matches || [];
            
            if (!matches || matches.length === 0) {
                return 0;
            }

            // Find matches for this library
            const libraryMatches = matches.filter(m => m.libraryId === libraryId);
            
            if (libraryMatches.length === 0) {
                return 0;
            }

            // Return top similarity as percentage, capped at FORMULA_CONFIDENCE_CAP
            const topMatch = libraryMatches[0];
            return Math.min(topMatch.similarity * 100, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score RAG', { error: error.message });
            return 0;
        }
    }

    /**
     * Score classification history
     */
    async scoreHistory(libraryId, item) {
        try {
            // Look for similar items in history
            const result = await db.query(`
                SELECT 
                    library_id,
                    MAX(confidence) AS confidence,
                    COUNT(*) as match_count
                FROM classification_history
                WHERE tmdb_id = $1
                AND status = 'completed'
                AND library_id IS NOT NULL
                GROUP BY library_id
                ORDER BY match_count DESC, confidence DESC
                LIMIT 5
            `, [item.tmdb_id]);

            if (result.rows.length === 0) {
                return 0;
            }

            // Find matches for this library
            const libraryMatch = result.rows.find(r => r.library_id === libraryId);
            
            if (!libraryMatch) {
                return 0;
            }

            // Score based on match count and historical confidence
            const matchCount = parseInt(libraryMatch.match_count);
            const historicalConfidence = parseFloat(libraryMatch.confidence);
            
            // More matches = higher confidence in pattern
            const countBoost = Math.min(matchCount * 10, 40);
            const baseScore = Math.min(historicalConfidence, 60);
            
            return Math.min(baseScore + countBoost, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score history', { error: error.message });
            return 0;
        }
    }

    /**
     * Score library profile match
     * Uses libraryProfileService to score item against library's statistical profile
     */
    async scoreProfile(libraryId, item) {
        try {
            const profileScore = await libraryProfileService.getProfileScore(libraryId, item);
            
            // Profile score is 0-100 where 50 is neutral:
            // - Scores <= 50 are treated as 0 (no positive contribution)
            // - Scores > 50 are scaled from 50-100 into 0-FORMULA_CONFIDENCE_CAP (e.g. 0-95)
            let finalScore = 0;
            if (profileScore > 50) {
                const scaledScore = ((profileScore - 50) / 50) * FORMULA_CONFIDENCE_CAP;
                finalScore = Math.max(0, Math.min(scaledScore, FORMULA_CONFIDENCE_CAP));
            }
            
            logger.debug('Profile score calculated', {
                libraryId,
                title: item.title,
                rawScore: profileScore,
                finalScore
            });
            
            return finalScore;

        } catch (error) {
            logger.error('Failed to score profile', { 
                error: error.message,
                libraryId,
                title: item.title
            });
            return 0; // Return 0 on error to be conservative (don't bias the score)
        }
    }

    /**
     * Rank and combine policy evaluations
     */
    async rankResults(evaluations) {
        try {
            // Sort by score descending
            const ranked = evaluations
                .filter(e => e.score > 0)
                .sort((a, b) => b.score - a.score);

            return ranked;

        } catch (error) {
            logger.error('Failed to rank results', { error: error.message });
            return evaluations;
        }
    }

    /**
     * Determine action based on ranked results
     */
    determineAction(ranked) {
        try {
            if (ranked.length === 0) {
                return {
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                };
            }

            const top = ranked[0];

            // Auto-classify if score meets threshold
            if (top.score >= top.auto_classify_threshold) {
                return {
                    action: 'auto_classify',
                    library: {
                        library_id: top.library_id,
                        library_name: top.library_name,
                        policy_id: top.policy_id,
                        policy_name: top.policy_name
                    },
                    confidence: top.score,
                    method: 'policy_engine',
                    scores: top.scores,
                    weights: top.weights,
                    ranked
                };
            }

            // Prompt for confirmation if meets prompt threshold
            if (top.score >= top.prompt_threshold) {
                return {
                    action: 'prompt_confirm',
                    library: {
                        library_id: top.library_id,
                        library_name: top.library_name,
                        policy_id: top.policy_id,
                        policy_name: top.policy_name
                    },
                    confidence: top.score,
                    method: 'policy_engine',
                    scores: top.scores,
                    weights: top.weights,
                    ranked
                };
            }

            // Below prompt threshold - show selection prompt
            return {
                action: 'prompt_select',
                confidence: top.score,
                method: 'policy_engine',
                ranked
            };

        } catch (error) {
            logger.error('Failed to determine action', { error: error.message });
            return {
                action: 'manual',
                confidence: 0,
                ranked
            };
        }
    }
}

module.exports = new PolicyEngine();
module.exports.FORMULA_CONFIDENCE_CAP = FORMULA_CONFIDENCE_CAP;
