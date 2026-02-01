/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createLogger } = require('../utils/logger');
const db = require('../config/database');

const logger = createLogger('ContextManager');

/**
 * Priority levels for context compression
 * Higher priority = kept when trimming for smaller models
 */
const CONTEXT_PRIORITY = {
    CRITICAL: 100,    // Always keep - core metadata
    HIGH: 80,         // Keep unless very constrained - signals, confidence
    MEDIUM: 50,       // Trim if needed - web research, keywords
    LOW: 20,          // Trim first - detailed breakdowns, optional data
};

/**
 * Estimated token counts for different context sections
 */
const TOKEN_ESTIMATES = {
    TITLE_METADATA: 100,      // Title, year, genres, rating
    OVERVIEW: 150,            // Media overview/description
    KEYWORDS: 50,             // Keywords list
    SIGNAL_BREAKDOWN: 200,    // Full signal breakdown
    SIGNAL_SUMMARY: 50,       // Compressed signal summary
    WEB_RESEARCH: 300,        // Tavily results
    LIBRARIES_LIST: 100,      // Available libraries
    PROMPT_TEMPLATE: 400,     // Fixed prompt instructions
};

/**
 * ContextManager - Handles context compression for smaller AI models
 * 
 * Features:
 * - Priority-based trimming of context sections
 * - Model-aware context limits
 * - Graceful degradation for small models
 */
class ContextManager {
    constructor() {
        this.modelLimits = null;
    }

    /**
     * Get model context limits from database or defaults
     */
    async getModelLimits() {
        if (this.modelLimits) return this.modelLimits;

        try {
            const result = await db.query(
                `SELECT model, context_window FROM ollama_config WHERE is_active = true LIMIT 1`
            );

            if (result.rows.length > 0) {
                const config = result.rows[0];
                // Estimate safe context: use 75% of window to leave room for response
                const contextWindow = config.context_window || 8192;
                this.modelLimits = {
                    model: config.model,
                    maxTokens: Math.floor(contextWindow * 0.75),
                    contextWindow,
                };
            } else {
                // Default for small models
                this.modelLimits = {
                    model: 'unknown',
                    maxTokens: 4096,
                    contextWindow: 8192,
                };
            }
        } catch (error) {
            logger.debug('Using default model limits', { error: error.message });
            this.modelLimits = {
                model: 'unknown',
                maxTokens: 4096,
                contextWindow: 8192,
            };
        }

        return this.modelLimits;
    }

    /**
     * Estimate token count for text (rough approximation: 1 token ≈ 4 chars)
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    /**
     * Compress context for smaller models
     * 
     * @param {object} fullContext - Full context object with all sections
     * @param {number} targetTokens - Target token limit (optional, uses model limits)
     * @returns {object} Compressed context with priority-based trimming
     */
    async compress(fullContext, targetTokens = null) {
        const limits = await this.getModelLimits();
        const maxTokens = targetTokens || limits.maxTokens;

        // Calculate current token usage
        const sections = this.buildSections(fullContext);
        let totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);

        logger.debug('Context compression analysis', {
            totalTokens,
            maxTokens,
            needsCompression: totalTokens > maxTokens,
            sections: sections.map(s => ({ name: s.name, tokens: s.tokens, priority: s.priority }))
        });

        // If we're under limit, return full context
        if (totalTokens <= maxTokens) {
            return {
                compressed: false,
                text: sections.map(s => s.content).join('\n\n'),
                tokensSaved: 0,
                originalTokens: totalTokens,
                finalTokens: totalTokens,
            };
        }

        // Sort by priority (low priority first for trimming)
        const sortedSections = [...sections].sort((a, b) => a.priority - b.priority);

        // Trim sections until we're under limit
        const includedSections = [];
        let keptTokens = 0;

        // First, add all CRITICAL sections
        for (const section of sections) {
            if (section.priority >= CONTEXT_PRIORITY.HIGH) {
                includedSections.push(section);
                keptTokens += section.tokens;
            }
        }

        // Then add remaining sections by priority until we hit limit
        for (const section of sortedSections.reverse()) {
            if (section.priority < CONTEXT_PRIORITY.HIGH) {
                if (keptTokens + section.tokens <= maxTokens) {
                    includedSections.push(section);
                    keptTokens += section.tokens;
                } else {
                    // Try to include a compressed version
                    if (section.compressedContent) {
                        const compressedTokens = this.estimateTokens(section.compressedContent);
                        if (keptTokens + compressedTokens <= maxTokens) {
                            includedSections.push({
                                ...section,
                                content: section.compressedContent,
                                tokens: compressedTokens,
                            });
                            keptTokens += compressedTokens;
                        }
                    }
                }
            }
        }

        // Sort back to original order for output
        const orderedSections = includedSections.sort((a, b) => a.order - b.order);

        return {
            compressed: true,
            text: orderedSections.map(s => s.content).join('\n\n'),
            tokensSaved: totalTokens - keptTokens,
            originalTokens: totalTokens,
            finalTokens: keptTokens,
            sectionsRemoved: sections.length - includedSections.length,
        };
    }

    /**
     * Build prioritized sections from full context
     */
    buildSections(context) {
        const sections = [];
        let order = 0;

        // Core metadata - CRITICAL
        if (context.metadata) {
            const meta = context.metadata;
            const content = `--- MEDIA INFORMATION ---
Title: ${meta.title}
Year: ${meta.year || 'Unknown'}
Genres: ${(meta.genres || []).join(', ') || 'None'}
Certification: ${meta.certification || 'Unknown'}
Language: ${meta.original_language || 'Unknown'}`;

            sections.push({
                name: 'metadata',
                content,
                tokens: this.estimateTokens(content),
                priority: CONTEXT_PRIORITY.CRITICAL,
                order: order++,
            });
        }

        // Signal summary - HIGH
        if (context.signalContext) {
            const sig = context.signalContext;
            const summaryContent = `--- SIGNAL SUMMARY ---
Suggested Library: "${sig.suggestedLibrary?.name || 'Unknown'}"
Confidence: ${sig.confidence}%
${sig.hasConflict ? '⚠️ CONFLICT DETECTED' : ''}`;

            sections.push({
                name: 'signalSummary',
                content: summaryContent,
                tokens: this.estimateTokens(summaryContent),
                priority: CONTEXT_PRIORITY.HIGH,
                order: order++,
            });

            // Full breakdown - MEDIUM (can be trimmed)
            if (sig.aiContext) {
                sections.push({
                    name: 'signalBreakdown',
                    content: sig.aiContext,
                    tokens: this.estimateTokens(sig.aiContext),
                    priority: CONTEXT_PRIORITY.MEDIUM,
                    order: order++,
                    compressedContent: summaryContent, // Use summary as compressed version
                });
            }

            // RAG context - HIGH (v0.34 semantic similarity)
            if (sig.ragContext) {
                sections.push({
                    name: 'ragContext',
                    content: `--- RAG SIMILARITY MATCHES ---\n${sig.ragContext}`,
                    tokens: this.estimateTokens(sig.ragContext),
                    priority: CONTEXT_PRIORITY.HIGH,
                    order: order++,
                });
            }
        }

        // Overview - MEDIUM
        if (context.metadata?.overview) {
            const overview = context.metadata.overview;
            const truncatedOverview = overview.length > 300
                ? overview.substring(0, 300) + '...'
                : overview;

            sections.push({
                name: 'overview',
                content: `Overview: ${overview}`,
                tokens: this.estimateTokens(overview),
                priority: CONTEXT_PRIORITY.MEDIUM,
                order: order++,
                compressedContent: `Overview: ${truncatedOverview}`,
            });
        }

        // Keywords - LOW
        if (context.metadata?.keywords?.length > 0) {
            const keywords = context.metadata.keywords.slice(0, 15).join(', ');
            const shortKeywords = context.metadata.keywords.slice(0, 5).join(', ');

            sections.push({
                name: 'keywords',
                content: `Keywords: ${keywords}`,
                tokens: this.estimateTokens(keywords),
                priority: CONTEXT_PRIORITY.LOW,
                order: order++,
                compressedContent: `Keywords: ${shortKeywords}`,
            });
        }

        // Web research - LOW (first to trim)
        if (context.webResearch) {
            sections.push({
                name: 'webResearch',
                content: context.webResearch,
                tokens: this.estimateTokens(context.webResearch),
                priority: CONTEXT_PRIORITY.LOW,
                order: order++,
            });
        }

        // Libraries list - HIGH
        if (context.libraries) {
            const librariesContent = `--- AVAILABLE LIBRARIES ---
${context.libraries.map((lib, i) => `${i + 1}. "${lib.name}"`).join('\n')}`;

            sections.push({
                name: 'libraries',
                content: librariesContent,
                tokens: this.estimateTokens(librariesContent),
                priority: CONTEXT_PRIORITY.HIGH,
                order: order++,
            });
        }

        return sections;
    }

    /**
     * Get compression stats for logging/debugging
     */
    getCompressionStats(result) {
        return {
            compressed: result.compressed,
            originalTokens: result.originalTokens,
            finalTokens: result.finalTokens,
            tokensSaved: result.tokensSaved,
            compressionRatio: result.compressed
                ? Math.round((result.tokensSaved / result.originalTokens) * 100)
                : 0,
        };
    }

    /**
     * Clear cached model limits (for config changes)
     */
    clearCache() {
        this.modelLimits = null;
    }
}

module.exports = new ContextManager();
module.exports.CONTEXT_PRIORITY = CONTEXT_PRIORITY;
