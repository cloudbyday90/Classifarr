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

const { createLogger } = require('../utils/logger');

const logger = createLogger('AIPromptBuilder');

/**
 * AIPromptBuilder - Modular, signal-driven AI prompt composition
 * 
 * Composes classification prompts from multiple signal sources using
 * dedicated formatters. Makes the system composable, testable, and extensible.
 * 
 * @see https://github.com/cloudbyday90/Classifarr/issues/212
 */
class AIPromptBuilder {
    constructor() {
        this.signalFormatters = new Map();
        this.registerDefaultFormatters();
    }

    /**
     * Register default signal formatters
     */
    registerDefaultFormatters() {
        this.register('media_item', this.formatMediaItem.bind(this));
        this.register('library_profile', this.formatLibraryProfile.bind(this));
        this.register('policy_engine', this.formatPolicySignals.bind(this));
        this.register('rag', this.formatRAGContext.bind(this));
        this.register('patterns', this.formatPatternSignals.bind(this));
        this.register('instructions', this.formatInstructions.bind(this));
    }

    /**
     * Register a custom formatter
     * @param {string} type - Signal type identifier
     * @param {Function} formatter - Formatter function
     */
    register(type, formatter) {
        this.signalFormatters.set(type, formatter);
        logger.debug('Registered signal formatter', { type });
    }

    /**
     * Build complete AI prompt from context
     * @param {object} context - Classification context with signal data
     * @param {object} options - Options for prompt building
     * @returns {Promise<string>} Composed AI prompt
     */
    async buildPrompt(context, options = {}) {
        const sections = [];
        const mode = options.mode || 'classify'; // 'classify' or 'verify'

        // Section order: media_item → library_profile → policy_engine → rag → patterns → instructions
        const sectionOrder = [
            'media_item',
            'library_profile',
            'policy_engine',
            'rag',
            'patterns',
            'instructions'
        ];

        for (const sectionType of sectionOrder) {
            const formatter = this.signalFormatters.get(sectionType);
            if (!formatter) {
                logger.warn('No formatter registered for section type', { sectionType });
                continue;
            }

            // Get data for this section from context
            const sectionData = this.getSectionData(sectionType, context, mode);
            if (!sectionData) {
                logger.debug('No data available for section, skipping', { sectionType });
                continue;
            }

            // Format section
            const formatted = await formatter(sectionData);
            if (formatted) {
                sections.push(formatted);
            }
        }

        // Join all sections with double newline
        return sections.join('\n\n');
    }

    /**
     * Extract data for a specific section from context
     * @param {string} sectionType - Section type
     * @param {object} context - Full context
     * @param {string} mode - Classification mode
     * @returns {object|null} Section data or null if not available
     */
    getSectionData(sectionType, context, mode) {
        switch (sectionType) {
            case 'media_item':
                return context.metadata || context.item || null;
            
            case 'library_profile':
                return context.libraryProfile || null;
            
            case 'policy_engine':
                return context.policySignals || context.signalContext || null;
            
            case 'rag':
                return context.ragContext || null;
            
            case 'patterns':
                return context.patternSignals || null;
            
            case 'instructions':
                return {
                    mode,
                    libraries: context.libraries || [],
                    signalContext: context.signalContext || null
                };
            
            default:
                return null;
        }
    }

    /**
     * Format media item details
     * @param {object} item - Media item with metadata
     * @returns {string|null} Formatted media item or null
     */
    formatMediaItem(item) {
        if (!item || !item.title) {
            return null;
        }

        const lines = [];
        lines.push('=== MEDIA ITEM ===');
        lines.push(`Title: ${item.title}`);
        
        if (item.year) {
            lines.push(`Year: ${item.year}`);
        }
        
        if (item.media_type) {
            lines.push(`Type: ${item.media_type}`);
        }
        
        if (item.certification) {
            lines.push(`Rating: ${item.certification}`);
        }
        
        // Handle genres (array or JSON string)
        const genres = this.parseArray(item.genres);
        if (genres && genres.length > 0) {
            lines.push(`Genres: ${genres.join(', ')}`);
        }
        
        if (item.overview) {
            lines.push(`Overview: ${item.overview}`);
        }
        
        // Handle keywords (array or JSON string)
        const keywords = this.parseArray(item.keywords);
        if (keywords && keywords.length > 0) {
            // Limit to first 15 keywords for prompt brevity
            lines.push(`Keywords: ${keywords.slice(0, 15).join(', ')}`);
        }

        // Add content analysis if available
        if (item.contentAnalysis && item.contentAnalysis.bestMatch) {
            lines.push(`Content Type: ${item.contentAnalysis.bestMatch.type} (${item.contentAnalysis.bestMatch.confidence}% confidence)`);
        }
        
        lines.push('==================');
        
        return lines.join('\n');
    }

    /**
     * Format library profile statistics
     * @param {object} data - Library profile data
     * @returns {string|null} Formatted library profile or null
     */
    formatLibraryProfile(data) {
        if (!data || !data.totalItems || data.totalItems === 0) {
            return null;
        }

        const lines = [];
        lines.push('=== LIBRARY PROFILE ===');
        lines.push(`Items: ${data.totalItems}`);
        
        // Content ratings distribution
        if (data.certificationDistribution && data.certificationDistribution.length > 0) {
            const topRatings = data.certificationDistribution
                .slice(0, 5)
                .map(r => `${r.certification} (${r.percentage}%)`)
                .join(', ');
            lines.push(`Content Ratings: ${topRatings}`);
        }
        
        // Genre distribution
        if (data.genreDistribution && data.genreDistribution.length > 0) {
            const topGenres = data.genreDistribution
                .slice(0, 5)
                .map(g => `${g.genre} (${g.percentage}%)`)
                .join(', ');
            lines.push(`Top Genres: ${topGenres}`);
        }

        // Studio distribution
        if (data.studioDistribution && data.studioDistribution.length > 0) {
            const topStudios = data.studioDistribution
                .slice(0, 3)
                .map(s => `${s.studio} (${s.percentage}%)`)
                .join(', ');
            lines.push(`Top Studios: ${topStudios}`);
        }
        
        lines.push('======================');
        
        return lines.join('\n');
    }

    /**
     * Format policy engine signals
     * @param {object} data - Policy evaluation result
     * @returns {string|null} Formatted policy signals or null
     */
    formatPolicySignals(data) {
        if (!data || !data.confidence) {
            return null;
        }

        const lines = [];
        lines.push('=== POLICY ENGINE SIGNALS ===');
        lines.push(`Calculated Confidence: ${data.confidence}%`);
        
        if (data.suggestedLibrary) {
            lines.push(`Suggested Library: ${data.suggestedLibrary.name}`);
        }

        // Show signal breakdown
        if (data.breakdown && data.breakdown.length > 0) {
            lines.push('Signal Breakdown:');
            for (const signal of data.breakdown) {
                const weight = signal.weight || 0;
                lines.push(`  ${signal.type}: score ${signal.score || 0} (weight: ${weight})`);
            }
        }

        // Show conflict warning if present
        if (data.hasConflict) {
            lines.push('⚠️ CONFLICT: Multiple libraries have similar scores');
        }
        
        lines.push('=============================');
        
        return lines.join('\n');
    }

    /**
     * Format RAG (Retrieval Augmented Generation) context
     * @param {object} data - RAG similar items
     * @returns {string|null} Formatted RAG context or null
     */
    formatRAGContext(data) {
        if (!data) {
            return null;
        }

        if (typeof data === 'string') {
            return data;
        }

        if (!data.similarItems || data.similarItems.length === 0) {
            return null;
        }

        const lines = [];
        lines.push('=== SIMILAR PAST CLASSIFICATIONS (RAG) ===');
        
        // Show top similar items
        for (const item of data.similarItems.slice(0, 5)) {
            const similarity = item.similarity || item.score || 0;
            const textSimilarity = item.textSimilarity;
            const imageSimilarity = item.imageSimilarity;
            const hasImageSignal = imageSimilarity !== null && imageSimilarity !== undefined;

            if (hasImageSignal) {
                const textPct = Math.round((textSimilarity || 0) * 100);
                const imagePct = Math.round(imageSimilarity * 100);
                const combinedPct = Math.round(similarity * 100);
                lines.push(
                    `  "${item.title}" → ${item.libraryName} (${combinedPct}% combined; text ${textPct}%, image ${imagePct}%)`
                );
            } else {
                lines.push(`  "${item.title}" → ${item.libraryName} (${Math.round(similarity * 100)}% similar)`);
            }
        }

        // Show RAG suggestion if available
        if (data.suggestion) {
            lines.push(`RAG Suggestion: ${data.suggestion.libraryName} (${data.suggestion.voteCount} matches)`);
        }
        
        lines.push('=========================================');
        
        return lines.join('\n');
    }

    /**
     * Format learned pattern signals
     * @param {object} data - Pattern signals
     * @returns {string|null} Formatted patterns or null
     */
    formatPatternSignals(data) {
        if (!data || !data.patterns || data.patterns.length === 0) {
            return null;
        }

        const lines = [];
        lines.push('=== LEARNED PATTERNS ===');
        
        for (const pattern of data.patterns.slice(0, 10)) {
            const type = pattern.pattern_type || pattern.type || 'unknown';
            const value = pattern.pattern_value || pattern.value || '';
            const library = pattern.library_name || pattern.libraryName || 'unknown';
            const confidence = pattern.confidence || pattern.score || 0;
            
            lines.push(`  ${type}: "${value}" → ${library} (${Math.round(confidence)}% confident)`);
        }
        
        lines.push('========================');
        
        return lines.join('\n');
    }

    /**
     * Format instructions - mode-aware (classify vs verify)
     * @param {object} data - Instruction data with mode
     * @returns {string|null} Formatted instructions
     */
    formatInstructions(data) {
        const mode = data.mode || 'classify';
        const libraries = data.libraries || [];
        const signalContext = data.signalContext;

        const lines = [];
        lines.push('=== YOUR TASK ===');
        
        if (mode === 'verify' && signalContext) {
            // Verification mode - AI verifies pre-calculated decision
            lines.push(`VERIFICATION MODE: The system has pre-calculated confidence of ${signalContext.confidence}% for library "${signalContext.suggestedLibrary?.name}".`);
            lines.push('');
            lines.push('Your role is to VERIFY this decision or REQUEST CLARIFICATION if you see conflicts.');
            lines.push('');
            lines.push('Respond in ONE of these formats:');
            lines.push('');
            lines.push('FORMAT 1 - CONFIRM the suggested library (if signals align):');
            lines.push('CONFIRM|<library_number>|<brief_verification_reason>');
            lines.push('');
            lines.push('FORMAT 2 - REQUEST CLARIFICATION (if signals conflict):');
            lines.push('CLARIFY|<problem_summary>|<why_uncertain>|<question>|<exact_library_name_1>|<exact_library_name_2>|<exact_library_name_3_optional>');
            lines.push('  ⚠ option names MUST be copied exactly from the AVAILABLE LIBRARIES list below — do not invent genre names.');
        } else {
            // Classification mode - AI determines the library
            lines.push('CLASSIFICATION MODE: Classify this item into the most appropriate library.');
            lines.push('');
            lines.push('Analyze the media and respond in ONE of these formats:');
            lines.push('');
            lines.push('FORMAT 1 - If you are confident:');
            lines.push('CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>');
            lines.push('');
            lines.push('FORMAT 2 - If you need clarification:');
            lines.push('CLARIFY|<problem_summary>|<why_uncertain>|<question>|<exact_library_name_1>|<exact_library_name_2>|<exact_library_name_3_optional>');
            lines.push('  ⚠ option names MUST be copied exactly from the AVAILABLE LIBRARIES list below — do not invent genre names.');
        }

        // Add available libraries
        if (libraries.length > 0) {
            lines.push('');
            lines.push('--- AVAILABLE LIBRARIES ---');
            libraries.forEach((lib, i) => {
                lines.push(`${i + 1}. "${lib.name}" (${lib.media_type})`);
            });
        }
        
        lines.push('=================');
        
        return lines.join('\n');
    }

    /**
     * Helper: Parse array or JSON string to array
     * @param {Array|string} value - Value to parse
     * @returns {Array|null} Parsed array or null
     */
    parseArray(value) {
        if (!value) return null;
        if (Array.isArray(value)) return value;
        
        // Try to parse JSON string
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : null;
            } catch (_e) {
                // Not JSON, maybe comma-separated?
                return value.split(',').map(v => v.trim()).filter(v => v);
            }
        }
        
        return null;
    }
}

// Export singleton instance
module.exports = new AIPromptBuilder();
