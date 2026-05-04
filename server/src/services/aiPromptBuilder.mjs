/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

class AIPromptBuilder {
    constructor(deps = {}) {
        this._logger = deps.logger || null;
        this._normalizeMetadataList = deps.normalizeMetadataList || null;
        this.signalFormatters = new Map();
        this.registerDefaultFormatters();
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('AIPromptBuilder');
        }
        return this._logger;
    }

    get normalizeMetadataList() {
        if (!this._normalizeMetadataList) {
            this._normalizeMetadataList = normalizeMetadataList;
        }
        return this._normalizeMetadataList;
    }

    registerDefaultFormatters() {
        this.register('media_item', this.formatMediaItem.bind(this));
        this.register('library_profile', this.formatLibraryProfile.bind(this));
        this.register('policy_engine', this.formatPolicySignals.bind(this));
        this.register('rag', this.formatRAGContext.bind(this));
        this.register('patterns', this.formatPatternSignals.bind(this));
        this.register('instructions', this.formatInstructions.bind(this));
    }

    register(type, formatter) {
        this.signalFormatters.set(type, formatter);
        this.logger.debug('Registered signal formatter', { type });
    }

    async buildPrompt(context, options = {}) {
        const sections = [];
        const mode = options.mode || 'classify';

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
                this.logger.warn('No formatter registered for section type', { sectionType });
                continue;
            }

            const sectionData = this.getSectionData(sectionType, context, mode);
            if (!sectionData) {
                this.logger.debug('No data available for section, skipping', { sectionType });
                continue;
            }

            const formatted = await formatter(sectionData);
            if (formatted) {
                sections.push(formatted);
            }
        }

        return sections.join('\n\n');
    }

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
        
        const genres = this.parseArray(item.genres);
        if (genres && genres.length > 0) {
            lines.push(`Genres: ${genres.join(', ')}`);
        }
        
        if (item.overview) {
            lines.push(`Overview: ${item.overview}`);
        }
        
        const keywords = this.parseArray(item.keywords);
        if (keywords && keywords.length > 0) {
            lines.push(`Keywords: ${keywords.slice(0, 15).join(', ')}`);
        }

        if (item.contentAnalysis && item.contentAnalysis.bestMatch) {
            lines.push(`Content Type: ${item.contentAnalysis.bestMatch.type} (${item.contentAnalysis.bestMatch.confidence}% confidence)`);
        }
        
        lines.push('==================');
        
        return lines.join('\n');
    }

    formatLibraryProfile(data) {
        if (!data || !data.totalItems || data.totalItems === 0) {
            return null;
        }

        const lines = [];
        lines.push('=== LIBRARY PROFILE ===');
        lines.push(`Items: ${data.totalItems}`);
        
        if (data.certificationDistribution && data.certificationDistribution.length > 0) {
            const topRatings = data.certificationDistribution
                .slice(0, 5)
                .map(r => `${r.certification} (${r.percentage}%)`)
                .join(', ');
            lines.push(`Content Ratings: ${topRatings}`);
        }
        
        if (data.genreDistribution && data.genreDistribution.length > 0) {
            const topGenres = data.genreDistribution
                .slice(0, 5)
                .map(g => `${g.genre} (${g.percentage}%)`)
                .join(', ');
            lines.push(`Top Genres: ${topGenres}`);
        }

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

        if (data.breakdown && data.breakdown.length > 0) {
            lines.push('Signal Breakdown:');
            for (const signal of data.breakdown) {
                const weight = signal.weight || 0;
                lines.push(`  ${signal.type}: score ${signal.score || 0} (weight: ${weight})`);
            }
        }

        if (data.hasConflict) {
            lines.push('⚠️ CONFLICT: Multiple libraries have similar scores');
        }

        if (data.relatedEvidenceSummary) {
            const s = data.relatedEvidenceSummary;
            lines.push('Related Evidence:');
            if (s.topLibrary) {
                lines.push(`  Top library from prior classifications: ${s.topLibrary} (${s.confidence}% confidence)`);
            }
            if (s.topScopes && s.topScopes.length > 0) {
                for (const scope of s.topScopes.slice(0, 3)) {
                    lines.push(`  ${scope.scope}: "${scope.label}" — ${scope.confidence}% (${scope.provenance ?? 'unknown'})`);
                }
            }
            if (s.hasConflict) {
                lines.push('  ⚠️ Related evidence points to multiple libraries');
            }
        }

        lines.push('=============================');
        
        return lines.join('\n');
    }

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

        if (data.suggestion) {
            lines.push(`RAG Suggestion: ${data.suggestion.libraryName} (${data.suggestion.voteCount} matches)`);
        }
        
        lines.push('=========================================');
        
        return lines.join('\n');
    }

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

    formatInstructions(data) {
        const mode = data.mode || 'classify';
        const libraries = data.libraries || [];
        const signalContext = data.signalContext;

        const lines = [];
        lines.push('=== YOUR TASK ===');
        
        if (mode === 'verify' && signalContext) {
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
            lines.push('CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>');
            lines.push('  ⚠ option numbers MUST come from the numbered AVAILABLE LIBRARIES list below — use the number, not the name.');
        } else {
            lines.push('CLASSIFICATION MODE: Classify this item into the most appropriate library.');
            lines.push('');
            lines.push('Analyze the media and respond in ONE of these formats:');
            lines.push('');
            lines.push('FORMAT 1 - If you are confident:');
            lines.push('CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>');
            lines.push('');
            lines.push('FORMAT 2 - If you need clarification:');
            lines.push('CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>');
            lines.push('  ⚠ option numbers MUST come from the numbered AVAILABLE LIBRARIES list below — use the number, not the name.');
        }

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

    parseArray(value) {
        if (!value) return null;
        if (Array.isArray(value)) return this.normalizeMetadataList(value);
        
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? this.normalizeMetadataList(parsed) : null;
            } catch (_e) {
                return value.split(',').map(v => v.trim()).filter(v => v);
            }
        }
        
        return null;
    }
}

const singleton = new AIPromptBuilder();

export default singleton;
export { AIPromptBuilder };
