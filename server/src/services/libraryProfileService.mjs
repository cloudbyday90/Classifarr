/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

const logger = createLogger('LibraryProfileService');

const ALL_RATINGS = [
    'G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'Unrated',
    'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'
];

class LibraryProfileService {
    async generateProfile(libraryId) {
        logger.info('Generating library profile', { libraryId });

        try {
            const itemsResult = await db.query(`
                SELECT 
                    msi.content_rating,
                    msi.genres,
                    msi.studio,
                    msi.metadata,
                    l.media_type
                FROM media_server_items msi
                JOIN libraries l ON msi.library_id = l.id
                WHERE msi.library_id = $1
            `, [libraryId]);

            const items = itemsResult.rows;
            if (items.length === 0) {
                logger.warn('No items found for library', { libraryId });
                return null;
            }

            const ratings = this.countDistribution(items, 'rating');
            const genres = this.countDistribution(items, 'genres');
            const studios = this.countDistribution(items, 'studio');
            const keywords = this.countDistribution(items, 'keywords');

            const exclusionRatings = this.findExclusions(ratings, ALL_RATINGS);
            const exclusionGenres = this.findExclusions(genres);
            const exclusionKeywords = this.findExclusions(keywords);

            const enrichedCount = items.filter(i =>
                i.metadata?.omdb || i.metadata?.tmdb
            ).length;

            await db.query(`
                INSERT INTO library_profiles (
                    library_id, rating_distribution, genre_distribution, 
                    studio_distribution, keyword_distribution,
                    exclusion_ratings, exclusion_genres, exclusion_keywords,
                    item_count, enriched_count, last_generated_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                ON CONFLICT (library_id) DO UPDATE SET
                    rating_distribution = EXCLUDED.rating_distribution,
                    genre_distribution = EXCLUDED.genre_distribution,
                    studio_distribution = EXCLUDED.studio_distribution,
                    keyword_distribution = EXCLUDED.keyword_distribution,
                    exclusion_ratings = EXCLUDED.exclusion_ratings,
                    exclusion_genres = EXCLUDED.exclusion_genres,
                    exclusion_keywords = EXCLUDED.exclusion_keywords,
                    item_count = EXCLUDED.item_count,
                    enriched_count = EXCLUDED.enriched_count,
                    last_generated_at = NOW(),
                    updated_at = NOW()
            `, [
                libraryId,
                JSON.stringify(ratings),
                JSON.stringify(genres),
                JSON.stringify(studios),
                JSON.stringify(keywords),
                exclusionRatings,
                exclusionGenres,
                exclusionKeywords,
                items.length,
                enrichedCount
            ]);

            logger.info('Library profile generated', {
                libraryId,
                itemCount: items.length,
                enrichedCount,
                topRating: Object.keys(ratings)[0],
                topGenre: Object.keys(genres)[0]
            });

            return {
                ratings,
                genres,
                studios,
                keywords,
                exclusionRatings,
                exclusionGenres,
                itemCount: items.length,
                enrichedCount
            };
        } catch (error) {
            logger.error('Failed to generate library profile', {
                libraryId,
                error: error.message
            });
            throw error;
        }
    }

    async generateAllProfiles() {
        const libraries = await db.query(`
            SELECT l.id, l.name, COUNT(msi.id) as item_count
            FROM libraries l
            LEFT JOIN media_server_items msi ON l.id = msi.library_id
            WHERE l.is_active = true
            GROUP BY l.id, l.name
            HAVING COUNT(msi.id) > 0
            ORDER BY COUNT(msi.id) DESC
        `);

        logger.info('Generating profiles for all libraries', {
            count: libraries.rows.length
        });

        const results = [];
        for (const lib of libraries.rows) {
            try {
                const profile = await this.generateProfile(lib.id);
                results.push({ id: lib.id, name: lib.name, success: true, profile });
            } catch (err) {
                results.push({ id: lib.id, name: lib.name, success: false, error: err.message });
                logger.error('Failed to generate profile for library', {
                    libraryId: lib.id,
                    error: err.message
                });
            }
        }

        logger.info('All library profiles generated', {
            total: libraries.rows.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });

        return results;
    }

    async getProfile(libraryId) {
        const result = await db.query(
            'SELECT * FROM library_profiles WHERE library_id = $1',
            [libraryId]
        );
        return result.rows[0] || null;
    }

    async getProfileScore(libraryId, itemMetadata) {
        const profile = await this.getProfile(libraryId);
        if (!profile) return 50;

        let score = 0;
        const rating = itemMetadata.certification || itemMetadata.content_rating;
        const itemGenres = normalizeMetadataList(itemMetadata.genres);
        const itemKeywords = normalizeMetadataList(itemMetadata.keywords);

        const ratingDist = profile.rating_distribution || {};
        const ratingPct = ratingDist[rating] || 0;
        if (ratingPct > 50) score += 30;
        else if (ratingPct > 20) score += 15;
        else if (ratingPct > 5) score += 5;

        const genreDist = profile.genre_distribution || {};
        for (const genre of itemGenres) {
            const genrePct = genreDist[genre] || 0;
            score += Math.min(genrePct * 0.3, 15);
        }

        const keywordDist = profile.keyword_distribution || {};
        for (const keyword of itemKeywords) {
            const keywordPct = keywordDist[keyword] || 0;
            if (keywordPct > 10) score += 5;
        }

        if (profile.exclusion_ratings?.includes(rating)) {
            score -= 50;
        }
        for (const genre of itemGenres) {
            if (profile.exclusion_genres?.includes(genre)) {
                score -= 30;
            }
        }
        for (const keyword of itemKeywords) {
            if (profile.exclusion_keywords?.includes(keyword)) {
                score -= 20;
            }
        }

        const finalScore = Math.max(0, Math.min(100, 50 + score));

        logger.debug('Profile score calculated', {
            libraryId,
            rating,
            genres: itemGenres.join(','),
            rawScore: score,
            finalScore
        });

        return finalScore;
    }

    countDistribution(items, field) {
        const counts = {};

        for (const item of items) {
            let values = [];

            if (field === 'rating') {
                const rating = item.content_rating || item.metadata?.omdb?.rated;
                if (rating) values = [rating];
            } else if (field === 'genres') {
                const genres = normalizeMetadataList(item.genres);
                values = genres.length > 0
                    ? genres
                    : normalizeMetadataList(item.metadata?.tmdb?.genres);
            } else if (field === 'studio') {
                const studio = item.studio ||
                    item.metadata?.tmdb?.production_companies?.[0]?.name;
                if (studio) values = [studio];
            } else if (field === 'keywords') {
                values = normalizeMetadataList(item.metadata?.tmdb?.keywords);
            }

            for (const val of values.filter(Boolean)) {
                const normalized = String(val).trim();
                if (normalized) {
                    counts[normalized] = (counts[normalized] || 0) + 1;
                }
            }
        }

        const total = items.length;
        const percentages = {};
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1]);

        for (const [key, count] of sorted) {
            percentages[key] = Math.round((count / total) * 100);
        }

        return percentages;
    }

    findExclusions(distribution, knownValues = null) {
        if (knownValues) {
            return knownValues.filter(v => !distribution[v]);
        }

        return [];
    }

    async getSettingValue(key, defaultValue) {
        try {
            const result = await db.query(
                'SELECT value FROM settings WHERE key = $1',
                [key]
            );
            if (result.rows.length > 0) {
                const value = result.rows[0].value;
                if (!isNaN(value)) return parseInt(value, 10);
                if (value === 'true') return true;
                if (value === 'false') return false;
                return value;
            }
            return defaultValue;
        } catch {
            return defaultValue;
        }
    }

    async getProfileStats(libraryId) {
        const stats = {
            certificationDistribution: await this.getCertificationDistribution(libraryId),
            genreDistribution: await this.getGenreDistribution(libraryId),
            studioDistribution: await this.getStudioDistribution(libraryId),
            languageDistribution: await this.getLanguageDistribution(libraryId),
            totalItems: await this.getTotalItems(libraryId),
            lastUpdated: new Date().toISOString()
        };

        return stats;
    }

    async getCertificationDistribution(libraryId) {
        try {
            const result = await db.query(`
                SELECT 
                    COALESCE(content_rating, 'Unknown') as certification,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
                FROM media_server_items
                WHERE library_id = $1
                GROUP BY content_rating
                ORDER BY count DESC
                LIMIT 10
            `, [libraryId]);

            return result.rows;
        } catch (error) {
            logger.error('Failed to get certification distribution', {
                libraryId,
                error: error.message
            });
            return [];
        }
    }

    async getGenreDistribution(libraryId) {
        try {
            const result = await db.query(`
                SELECT 
                    genre,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
                FROM media_server_items,
                     unnest(genres) as genre
                WHERE library_id = $1
                  AND genres IS NOT NULL
                GROUP BY genre
                ORDER BY count DESC
                LIMIT 10
            `, [libraryId]);

            return result.rows;
        } catch (error) {
            logger.error('Failed to get genre distribution', {
                libraryId,
                error: error.message
            });
            return [];
        }
    }

    async getStudioDistribution(libraryId) {
        try {
            const result = await db.query(`
                SELECT 
                    COALESCE(studio, 'Unknown') as studio,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
                FROM media_server_items
                WHERE library_id = $1
                AND studio IS NOT NULL
                AND studio != ''
                GROUP BY studio
                ORDER BY count DESC
                LIMIT 5
            `, [libraryId]);

            return result.rows;
        } catch (error) {
            logger.error('Failed to get studio distribution', {
                libraryId,
                error: error.message
            });
            return [];
        }
    }

    async getLanguageDistribution(libraryId) {
        try {
            const result = await db.query(`
                SELECT 
                    COALESCE(
                        metadata->>'original_language', 
                        'Unknown'
                    ) as language,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
                FROM media_server_items
                WHERE library_id = $1
                GROUP BY metadata->>'original_language'
                ORDER BY count DESC
                LIMIT 5
            `, [libraryId]);

            return result.rows;
        } catch (error) {
            logger.error('Failed to get language distribution', {
                libraryId,
                error: error.message
            });
            return [];
        }
    }

    async getTotalItems(libraryId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*)::int as total
                FROM media_server_items
                WHERE library_id = $1
            `, [libraryId]);

            return result.rows[0]?.total || 0;
        } catch (error) {
            logger.error('Failed to get total items', {
                libraryId,
                error: error.message
            });
            return 0;
        }
    }

    formatForPrompt(stats) {
        const lines = [];

        lines.push('=== LIBRARY PROFILE STATISTICS ===');
        lines.push(`Total items in library: ${stats.totalItems}`);
        lines.push('');

        if (stats.certificationDistribution.length > 0) {
            lines.push('Content Rating Distribution:');
            stats.certificationDistribution.forEach(c => {
                lines.push(`  - ${c.certification}: ${c.percentage}% (${c.count} items)`);
            });
            lines.push('');
        }

        if (stats.genreDistribution.length > 0) {
            lines.push('Genre Distribution:');
            stats.genreDistribution.forEach(g => {
                lines.push(`  - ${g.genre}: ${g.percentage}% (${g.count} items)`);
            });
            lines.push('');
        }

        if (stats.studioDistribution.length > 0) {
            lines.push('Top Studios:');
            stats.studioDistribution.forEach(s => {
                lines.push(`  - ${s.studio}: ${s.percentage}% (${s.count} items)`);
            });
            lines.push('');
        }

        if (stats.languageDistribution.length > 0) {
            lines.push('Language Distribution:');
            stats.languageDistribution.forEach(l => {
                lines.push(`  - ${l.language}: ${l.percentage}% (${l.count} items)`);
            });
        }

        lines.push('=================================');

        return lines.join('\n');
    }

    async cacheProfileStats(libraryId, stats) {
        logger.debug('Profile stats cached', { libraryId });
        return stats;
    }

    async updateAndNotify(libraryId) {
        const stats = await this.getProfileStats(libraryId);

        await this.cacheProfileStats(libraryId, stats);

        logger.info('Profile updated', { libraryId, totalItems: stats.totalItems });

        return stats;
    }
}

function createLibraryProfileService() {
    return new LibraryProfileService();
}

const libraryProfileService = createLibraryProfileService();

export default libraryProfileService;
export {
    ALL_RATINGS,
    LibraryProfileService,
    createLibraryProfileService,
};
