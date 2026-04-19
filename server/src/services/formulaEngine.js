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

/*
 * Formula Engine
 * Calculates transparent probability scores for library classification
 * CRITICAL: Formula scores are CAPPED at 95% (100% reserved for authoritative signals)
 */

const db = require('../config/database');
const libraryProfileService = require('./libraryProfileService');
const ragRetriever = require('./ragRetriever');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataList } = require('../utils/metadataNormalization');

const logger = createLogger('FormulaEngine');

const FORMULA_CONFIDENCE_CAP = 95;
const RULE_MATCH_BASE_SCORE = 80;
const RULE_MATCH_BONUS_SCORE = 5;
const MIN_HISTORY_OBSERVATIONS = 2;

class FormulaEngine {
    normalizeRuleFieldValue(fieldValue) {
        if (Array.isArray(fieldValue)) {
            const normalized = normalizeMetadataList(fieldValue);
            if (normalized.length > 0) {
                return normalized;
            }

            return fieldValue.map((value) => String(value));
        }

        return fieldValue;
    }

    /**
     * Get formula weights from config
     * Reads from ai_provider_config table
     */
    async getWeights() {
        try {
            const result = await db.query(`
                SELECT 
                    formula_pattern_weight,
                    formula_rule_weight,
                    formula_rag_weight,
                    formula_history_weight
                FROM ai_provider_config
                WHERE id = 1
            `);

            const config = result.rows[0] || {};

            return {
                profile: config.formula_pattern_weight ?? 0.40, // v0.38.0: renamed from pattern to profile
                rule: config.formula_rule_weight ?? 0.30,
                rag: config.formula_rag_weight ?? 0.20,
                history: config.formula_history_weight ?? 0.10
            };
        } catch (error) {
            logger.error('Failed to get formula weights', { error: error.message });
            // Return defaults on error
            return {
                profile: 0.40, // v0.38.0: renamed from pattern to profile
                rule: 0.30,
                rag: 0.20,
                history: 0.10
            };
        }
    }

    /**
     * Get active libraries from database
     */
    async getActiveLibraries() {
        try {
            const result = await db.query(`
                SELECT id, name, path, media_type, media_server_id
                FROM libraries
                WHERE is_active = true
                ORDER BY name
            `);

            return result.rows;
        } catch (error) {
            logger.error('Failed to get active libraries', { error: error.message });
            return [];
        }
    }

    /**
     * Score patterns for a library (0-95)
     * DEPRECATED in v0.38.0 - Use scoreProfile instead
     * @deprecated
     */
    async scorePatterns(metadata, library) {
        // Delegate to profile scoring in v0.38.0
        return this.scoreProfile(metadata, library);
    }

    /**
     * Score library profile match (0-95)
     * v0.38.0+: Uses library profiles instead of patterns
     * Returns profile match score from libraryProfileService
     */
    async scoreProfile(metadata, library) {
        try {
            const profileScore = await libraryProfileService.getProfileScore(library.id, metadata);

            // Profile score is 0-100 with 50 as neutral
            // Convert to formula score: (score - 50) * 2 for positive, 0 for negative
            if (profileScore > 50) {
                // Positive match: scale 50-100 to 0-95
                const scaled = ((profileScore - 50) / 50) * FORMULA_CONFIDENCE_CAP;
                return Math.min(scaled, FORMULA_CONFIDENCE_CAP);
            } else if (profileScore < 50) {
                // Negative match: return 0 (no contribution)
                return 0;
            }
            return 0; // Neutral (50) = no contribution
        } catch (error) {
            logger.debug('Failed to score profile', {
                error: error.message,
                library: library.name
            });
            return 0;
        }
    }

    /**
     * Score rules for a library (0-95)
     * Uses library custom rules to evaluate rules
     * Returns a corroboration score for matching rules
     */
    async scoreRules(metadata, library) {
        try {
            // Get active custom rules for this library
            const result = await db.query(`
                SELECT id, name, rule_json
                FROM library_custom_rules
                WHERE library_id = $1 AND is_active = true
            `, [library.id]);

            if (result.rows.length === 0) {
                return 0;
            }

            let matchCount = 0;

            for (const rule of result.rows) {
                const matches = this.evaluateRule(metadata, rule.rule_json);
                if (matches) {
                    matchCount++;
                }
            }

            if (matchCount === 0) {
                return 0;
            }

            const corroborationBonus = Math.max(0, matchCount - 1) * RULE_MATCH_BONUS_SCORE;
            const score = RULE_MATCH_BASE_SCORE + corroborationBonus;
            return Math.min(score, FORMULA_CONFIDENCE_CAP);
        } catch (error) {
            logger.error('Failed to score rules', {
                error: error.message,
                library: library.name
            });
            return 0;
        }
    }

    /**
     * Evaluate a single rule against metadata
     * @param {object} metadata - Media metadata
     * @param {object} rule - Rule JSON object
     * @returns {boolean} - True if rule matches
     */
    evaluateRule(metadata, rule) {
        try {
            const { field, operator, value } = rule;

            if (!field || !operator || value === undefined) {
                return false;
            }

            const fieldValue = this.normalizeRuleFieldValue(metadata[field]);

            if (fieldValue === undefined || fieldValue === null) {
                return false;
            }

            switch (operator) {
                case 'contains':
                    if (Array.isArray(fieldValue)) {
                        return fieldValue.some(v =>
                            String(v).toLowerCase().includes(String(value).toLowerCase())
                        );
                    }
                    return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());

                case 'equals':
                    return String(fieldValue).toLowerCase() === String(value).toLowerCase();

                case 'greater_than':
                    return parseFloat(fieldValue) > parseFloat(value);

                case 'less_than':
                    return parseFloat(fieldValue) < parseFloat(value);

                case 'is_one_of':
                    const values = Array.isArray(value) ? value : [value];
                    if (Array.isArray(fieldValue)) {
                        // Check if any fieldValue is in values list
                        return fieldValue.some(fv =>
                            values.some(v => String(fv).toLowerCase() === String(v).toLowerCase())
                        );
                    }
                    return values.some(v => String(fieldValue).toLowerCase() === String(v).toLowerCase());

                case 'not_contains':
                    if (Array.isArray(fieldValue)) {
                        return !fieldValue.some(v =>
                            String(v).toLowerCase().includes(String(value).toLowerCase())
                        );
                    }
                    return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());

                default:
                    return false;
            }
        } catch (error) {
            logger.debug('Error evaluating rule', { error: error.message });
            return false;
        }
    }

    /**
     * Score RAG similarity for a library (0-95)
     * Uses ragRetriever for semantic search
     * Returns top similarity score * 100
     */
    async scoreRAG(metadata, library) {
        try {
            const matches = await ragRetriever.semanticSearch(metadata, 5);

            if (!matches || matches.length === 0) {
                return 0;
            }

            // Find matches that point to this library
            const libraryMatches = matches.filter(m => m.libraryId === library.id);

            if (libraryMatches.length === 0) {
                return 0;
            }

            // Return the top similarity score as a percentage
            const topMatch = libraryMatches[0];
            const score = topMatch.similarity * 100;
            return Math.min(score, FORMULA_CONFIDENCE_CAP);
        } catch (error) {
            logger.error('Failed to score RAG', {
                error: error.message,
                library: library.name
            });
            return 0;
        }
    }

    /**
     * Score based on user correction history (0-95)
     * Returns 0 when history is missing or insufficient.
     */
    async scoreHistory(metadata, library) {
        try {
            // Check if this TMDB ID has been classified before
            if (!metadata.tmdb_id) {
                return 0;
            }

            // Get classification history for this TMDB ID
            const historyResult = await db.query(`
                SELECT library_id, COUNT(*) as count
                FROM classification_history
                WHERE tmdb_id = $1
                GROUP BY library_id
            `, [metadata.tmdb_id]);

            if (historyResult.rows.length === 0) {
                return 0;
            }

            // Count how many times it was classified to this library vs others
            let thisLibraryCount = 0;
            let otherLibraryCount = 0;

            for (const row of historyResult.rows) {
                const count = Number.parseInt(row.count, 10);
                if (!Number.isInteger(count) || count <= 0) {
                    continue;
                }

                if (row.library_id === library.id) {
                    thisLibraryCount = count;
                } else {
                    otherLibraryCount += count;
                }
            }

            const totalCount = thisLibraryCount + otherLibraryCount;

            if (totalCount < MIN_HISTORY_OBSERVATIONS) {
                return 0;
            }

            // Calculate success rate: percentage of times it was classified to this library
            const successRate = thisLibraryCount / totalCount;

            // Convert to score (0-100)
            // 100% success = 95 score, 0% success = 0 score
            const score = successRate * FORMULA_CONFIDENCE_CAP;

            return Math.min(score, FORMULA_CONFIDENCE_CAP);
        } catch (error) {
            logger.error('Failed to score history', {
                error: error.message,
                library: library.name
            });
            return 0;
        }
    }

    /**
     * Calculate probability scores for all libraries
     * Returns sorted array of libraries with scores and breakdowns
     * CRITICAL: All scores capped at 95%
     */
    async calculateLibraryScores(metadata, _options = {}) {
        try {
            const weights = await this.getWeights();
            const libraries = await this.getActiveLibraries();

            if (libraries.length === 0) {
                logger.warn('No active libraries found');
                return [];
            }

            const results = [];

            for (const library of libraries) {
                // Calculate individual component scores (all capped at 95%)
                const breakdown = {
                    profile: Math.min(await this.scoreProfile(metadata, library), FORMULA_CONFIDENCE_CAP),
                    rule: Math.min(await this.scoreRules(metadata, library), FORMULA_CONFIDENCE_CAP),
                    rag: Math.min(await this.scoreRAG(metadata, library), FORMULA_CONFIDENCE_CAP),
                    history: Math.min(await this.scoreHistory(metadata, library), FORMULA_CONFIDENCE_CAP)
                };

                // Calculate weighted total score
                let totalScore =
                    (breakdown.profile * weights.profile) +
                    (breakdown.rule * weights.rule) +
                    (breakdown.rag * weights.rag) +
                    (breakdown.history * weights.history);

                // CRITICAL: Cap total score at 95%
                totalScore = Math.min(totalScore, FORMULA_CONFIDENCE_CAP);

                results.push({
                    library: {
                        id: library.id,
                        name: library.name,
                        path: library.path,
                        media_type: library.media_type
                    },
                    score: Math.round(totalScore * 100) / 100, // Round to 2 decimals
                    breakdown: {
                        profile: Math.round(breakdown.profile * 100) / 100,
                        rule: Math.round(breakdown.rule * 100) / 100,
                        rag: Math.round(breakdown.rag * 100) / 100,
                        history: Math.round(breakdown.history * 100) / 100
                    },
                    weights
                });
            }

            // Sort by score descending
            results.sort((a, b) => b.score - a.score);

            logger.debug('Calculated library scores', {
                title: metadata.title,
                libraryCount: results.length,
                topScore: results[0]?.score || 0
            });

            return results;
        } catch (error) {
            logger.error('Failed to calculate library scores', { error: error.message });
            return [];
        }
    }
}

module.exports = new FormulaEngine();
module.exports.FORMULA_CONFIDENCE_CAP = FORMULA_CONFIDENCE_CAP;
