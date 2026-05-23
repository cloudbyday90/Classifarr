import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
    countDistribution as _countDistribution,
    findExclusions as _findExclusions,
    computeProfileScore,
    formatProfileForPrompt as _formatProfileForPrompt,
} from './libraryProfileComputations.mjs';
import {
    getCertificationDistribution as _getCertificationDistribution,
    getGenreDistribution as _getGenreDistribution,
    getStudioDistribution as _getStudioDistribution,
    getLanguageDistribution as _getLanguageDistribution,
    getTotalItems as _getTotalItems,
} from './libraryProfileQueries.mjs';

const logger = createLogger('LibraryProfileService');

export const ALL_RATINGS = [
    'G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'Unrated',
    'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'
];

export class LibraryProfileService {
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

        const { rawScore, finalScore } = computeProfileScore(profile, itemMetadata);

        logger.debug('Profile score calculated', {
            libraryId,
            rating: itemMetadata.certification || itemMetadata.content_rating,
            genres: normalizeMetadataList(itemMetadata.genres).join(','),
            rawScore,
            finalScore
        });

        return finalScore;
    }

    countDistribution(items, field) {
        return _countDistribution(items, field);
    }

    findExclusions(distribution, knownValues) {
        return _findExclusions(distribution, knownValues);
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
        return _getCertificationDistribution(db, logger, libraryId);
    }

    async getGenreDistribution(libraryId) {
        return _getGenreDistribution(db, logger, libraryId);
    }

    async getStudioDistribution(libraryId) {
        return _getStudioDistribution(db, logger, libraryId);
    }

    async getLanguageDistribution(libraryId) {
        return _getLanguageDistribution(db, logger, libraryId);
    }

    async getTotalItems(libraryId) {
        return _getTotalItems(db, logger, libraryId);
    }

    formatForPrompt(stats) {
        return _formatProfileForPrompt(stats);
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

export function createLibraryProfileService() {
    return new LibraryProfileService();
}

export const libraryProfileService = createLibraryProfileService();
