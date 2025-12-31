/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const embeddingService = require('./embeddingService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RAGRetriever');

/**
 * RAG Retriever Service
 * Performs semantic similarity search to find similar past classifications
 */
class RAGRetriever {
    /**
     * Search for similar classifications using vector similarity
     * @param {object} metadata - Metadata of item to search for
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>} Similar classifications with scores
     */
    async semanticSearch(metadata, limit = 5) {
        try {
            // Check if RAG is enabled
            const enabled = await embeddingRouter.isEnabled();
            if (!enabled) {
                return [];
            }

            // Check minimum embeddings threshold
            const hasMinimum = await embeddingService.hasMinimumEmbeddings();
            if (!hasMinimum) {
                logger.debug('Not enough embeddings for RAG');
                return [];
            }

            // Get config for threshold
            const config = await embeddingRouter.getConfig();
            const threshold = config?.rag_similarity_threshold || 0.70;

            // Generate embedding for query
            const text = embeddingService.formatForEmbedding(metadata);
            const queryResult = await embeddingRouter.embed(text);

            // Convert to pgvector format
            const vectorString = `[${queryResult.embedding.join(',')}]`;

            // Perform similarity search
            const result = await db.query(`
                SELECT 
                    ce.id,
                    ce.classification_id,
                    ch.title,
                    ch.media_type,
                    ch.library_id,
                    ch.library_name,
                    ch.method,
                    ch.confidence,
                    ch.created_at,
                    1 - (ce.embedding <=> $1::vector) as similarity
                FROM classification_embeddings ce
                JOIN classification_history ch ON ce.classification_id = ch.id
                WHERE ce.is_stale = false
                AND ch.library_id IS NOT NULL
                ORDER BY ce.embedding <=> $1::vector
                LIMIT $2
            `, [vectorString, limit]);

            // Filter by threshold and format results
            const matches = result.rows
                .filter(row => row.similarity >= threshold)
                .map(row => ({
                    classificationId: row.classification_id,
                    title: row.title,
                    mediaType: row.media_type,
                    libraryId: row.library_id,
                    libraryName: row.library_name,
                    method: row.method,
                    confidence: row.confidence,
                    similarity: Math.round(row.similarity * 100) / 100,
                    date: row.created_at
                }));

            logger.debug('Semantic search completed', {
                query: metadata.title,
                matches: matches.length,
                topSimilarity: matches[0]?.similarity || 0
            });

            return matches;

        } catch (error) {
            logger.error('Semantic search failed', { error: error.message });
            return [];
        }
    }

    /**
     * Hybrid search combining vector similarity and full-text search
     * @param {object} metadata - Metadata to search for
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Combined search results
     */
    async hybridSearch(metadata, limit = 5) {
        try {
            // Get semantic matches
            const semanticMatches = await this.semanticSearch(metadata, limit);

            // Get full-text matches
            const textMatches = await this.fullTextSearch(metadata, limit);

            // Combine and deduplicate by classification_id
            const combined = new Map();

            // Add semantic matches with vector score
            for (const match of semanticMatches) {
                combined.set(match.classificationId, {
                    ...match,
                    vectorScore: match.similarity,
                    textScore: 0
                });
            }

            // Add/update text matches
            for (const match of textMatches) {
                if (combined.has(match.classificationId)) {
                    combined.get(match.classificationId).textScore = match.textScore;
                } else {
                    combined.set(match.classificationId, {
                        ...match,
                        vectorScore: 0,
                        textScore: match.textScore
                    });
                }
            }

            // Calculate combined score and sort
            const results = Array.from(combined.values())
                .map(item => ({
                    ...item,
                    combinedScore: (item.vectorScore * 0.7) + (item.textScore * 0.3)
                }))
                .sort((a, b) => b.combinedScore - a.combinedScore)
                .slice(0, limit);

            return results;

        } catch (error) {
            logger.error('Hybrid search failed', { error: error.message });
            return [];
        }
    }

    /**
     * Full-text search on classification history
     */
    async fullTextSearch(metadata, limit = 5) {
        try {
            const searchTerms = [
                metadata.title,
                metadata.library_name
            ].filter(Boolean).join(' ');

            if (!searchTerms) return [];

            const result = await db.query(`
                SELECT 
                    id as classification_id,
                    title,
                    media_type,
                    library_id,
                    library_name,
                    ts_rank(search_text, plainto_tsquery('english', $1)) as text_score
                FROM classification_history
                WHERE search_text @@ plainto_tsquery('english', $1)
                AND library_id IS NOT NULL
                ORDER BY text_score DESC
                LIMIT $2
            `, [searchTerms, limit]);

            return result.rows.map(row => ({
                classificationId: row.classification_id,
                title: row.title,
                mediaType: row.media_type,
                libraryId: row.library_id,
                libraryName: row.library_name,
                textScore: Math.round(row.text_score * 100) / 100
            }));

        } catch (error) {
            logger.debug('Full-text search failed', { error: error.message });
            return [];
        }
    }

    /**
     * Calculate dynamic weight for semantic similarity signal
     * Based on match quality and unanimity
     * @param {Array} matches - Similar matches from search
     * @returns {number} Weight between 50-90
     */
    calculateDynamicWeight(matches) {
        if (!matches || matches.length === 0) {
            return 0;
        }

        const topMatch = matches[0]?.similarity || 0;

        // Check if all matches point to same library
        const libraryIds = matches.map(m => m.libraryId);
        const uniqueLibraries = new Set(libraryIds);
        const unanimous = uniqueLibraries.size === 1;

        // Dynamic weight based on quality and unanimity
        if (matches.length >= 3 && unanimous && topMatch > 0.90) {
            return 90;
        }
        if (matches.length >= 2 && unanimous && topMatch > 0.80) {
            return 80;
        }
        if (matches.length >= 1 && topMatch > 0.70) {
            return 70;
        }
        if (topMatch > 0.60) {
            return 60;
        }
        return 50;
    }

    /**
     * Get the suggested library from similar matches
     * @param {Array} matches - Similar matches
     * @returns {object|null} Suggested library with confidence
     */
    getSuggestedLibrary(matches) {
        if (!matches || matches.length === 0) {
            return null;
        }

        // Count votes by library
        const votes = {};
        for (const match of matches) {
            if (!votes[match.libraryId]) {
                votes[match.libraryId] = {
                    libraryId: match.libraryId,
                    libraryName: match.libraryName,
                    count: 0,
                    totalSimilarity: 0
                };
            }
            votes[match.libraryId].count++;
            votes[match.libraryId].totalSimilarity += match.similarity;
        }

        // Find winner
        const winner = Object.values(votes)
            .sort((a, b) => b.totalSimilarity - a.totalSimilarity)[0];

        return {
            libraryId: winner.libraryId,
            libraryName: winner.libraryName,
            voteCount: winner.count,
            avgSimilarity: Math.round((winner.totalSimilarity / winner.count) * 100) / 100
        };
    }

    /**
     * Format matches for AI context
     * @param {Array} matches - Similar matches
     * @returns {string} Formatted string for AI prompt
     */
    formatForAIContext(matches) {
        if (!matches || matches.length === 0) {
            return '';
        }

        const lines = ['Similar past classifications:'];
        for (const match of matches.slice(0, 3)) {
            lines.push(`- "${match.title}" → ${match.libraryName} (${Math.round(match.similarity * 100)}% similar)`);
        }

        const suggested = this.getSuggestedLibrary(matches);
        if (suggested) {
            lines.push(`\nRAG suggests: ${suggested.libraryName} (${suggested.voteCount} similar items)`);
        }

        return lines.join('\n');
    }
}

module.exports = new RAGRetriever();
