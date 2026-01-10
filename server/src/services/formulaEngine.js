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

/*
 * Formula Engine
 * Calculates transparent probability scores for library classification
 * CRITICAL: Formula scores are CAPPED at 95% (100% reserved for authoritative signals)
 */

const db = require('../config/database');
const patternSignalCollector = require('./patternSignalCollector');
const ragRetriever = require('./ragRetriever');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FormulaEngine');

const FORMULA_CONFIDENCE_CAP = 95;

class FormulaEngine {
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
                pattern: config.formula_pattern_weight || 0.40,
                rule: config.formula_rule_weight || 0.30,
                rag: config.formula_rag_weight || 0.20,
                history: config.formula_history_weight || 0.10
            };
        } catch (error) {
            logger.error('Failed to get formula weights', { error: error.message });
            // Return defaults on error
            return {
                pattern: 0.40,
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
     * Uses patternSignalCollector to get matching patterns
     * Returns highest confidence pattern match
     */
    async scorePatterns(metadata, library) {
        try {
            const signals = await patternSignalCollector.collectSignals(metadata, 0);
            
            if (!signals || signals.length === 0) {
                return 0;
            }

            // Find the highest confidence pattern that matches this library
            const librarySignals = signals.filter(s => s.library?.id === library.id);
            
            if (librarySignals.length === 0) {
                return 0;
            }

            // Return the highest confidence
            const topSignal = librarySignals[0]; // Already sorted by confidence descending
            return Math.min(topSignal.confidence, FORMULA_CONFIDENCE_CAP);
        } catch (error) {
            logger.error('Failed to score patterns', { 
                error: error.message,
                library: library.name 
            });
            return 0;
        }
    }

    /**
     * Score rules for a library (0-95)
     * Uses library custom rules to evaluate rules
     * Returns average confidence of matching rules
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
            let totalConfidence = 0;

            for (const rule of result.rows) {
                const matches = this.evaluateRule(metadata, rule.rule_json);
                if (matches) {
                    matchCount++;
                    // Each matching rule contributes a base confidence of 80
                    totalConfidence += 80;
                }
            }

            if (matchCount === 0) {
                return 0;
            }

            // Return average confidence, capped at 95
            const avgConfidence = totalConfidence / matchCount;
            return Math.min(avgConfidence, FORMULA_CONFIDENCE_CAP);
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

            const fieldValue = metadata[field];

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
     * Calculates: 100 - (correction_rate * 100)
     * Returns 50 (neutral) when no history exists
     */
    async scoreHistory(metadata, library) {
        try {
            // Check if this TMDB ID has been classified before
            if (!metadata.tmdb_id) {
                return 50; // Neutral score when no TMDB ID
            }

            // Get classification history for this TMDB ID
            const historyResult = await db.query(`
                SELECT library_id, COUNT(*) as count
                FROM classification_history
                WHERE tmdb_id = $1
                GROUP BY library_id
            `, [metadata.tmdb_id]);

            if (historyResult.rows.length === 0) {
                return 50; // Neutral score when no history
            }

            // Count how many times it was classified to this library vs others
            let thisLibraryCount = 0;
            let otherLibraryCount = 0;

            for (const row of historyResult.rows) {
                if (row.library_id === library.id) {
                    thisLibraryCount = parseInt(row.count);
                } else {
                    otherLibraryCount += parseInt(row.count);
                }
            }

            const totalCount = thisLibraryCount + otherLibraryCount;

            if (totalCount === 0) {
                return 50; // Neutral score
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
            return 50; // Neutral score on error
        }
    }

    /**
     * Calculate probability scores for all libraries
     * Returns sorted array of libraries with scores and breakdowns
     * CRITICAL: All scores capped at 95%
     */
    async calculateLibraryScores(metadata, options = {}) {
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
                    pattern: Math.min(await this.scorePatterns(metadata, library), FORMULA_CONFIDENCE_CAP),
                    rule: Math.min(await this.scoreRules(metadata, library), FORMULA_CONFIDENCE_CAP),
                    rag: Math.min(await this.scoreRAG(metadata, library), FORMULA_CONFIDENCE_CAP),
                    history: Math.min(await this.scoreHistory(metadata, library), FORMULA_CONFIDENCE_CAP)
                };

                // Calculate weighted total score
                let totalScore = 
                    (breakdown.pattern * weights.pattern) +
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
                        pattern: Math.round(breakdown.pattern * 100) / 100,
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
