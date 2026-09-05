import { generateLibraryProfileObservation } from './libraryProfileObservationPersistence.mjs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
    countDistribution as _countDistribution,
    findExclusions as _findExclusions,
    computeProfileScoreDetails,
    formatProfileForPrompt as _formatProfileForPrompt,
} from './libraryProfileComputations.mjs';
import {
    readLibraryProfileObservation,
    getCertificationDistribution as _getCertificationDistribution,
    getGenreDistribution as _getGenreDistribution,
    getStudioDistribution as _getStudioDistribution,
    getLanguageDistribution as _getLanguageDistribution,
    getTotalItems as _getTotalItems,
} from './libraryProfileQueries.mjs';

const logger = createLogger('LibraryProfileService');

export class LibraryProfileService {
    constructor({ dbClient = db } = {}) {
        this.db = dbClient;
    }

    async generateProfile(libraryId) {
        const profile = await generateLibraryProfileObservation(this.db, libraryId);
        logger.info('Library profile observation generated', { libraryId, itemCount: profile?.itemCount || 0 });
        return profile;
    }

    async generateAllProfiles() {
        const libraries = await this.db.query(`
            SELECT l.id, l.name, COUNT(msi.id) as item_count
            FROM libraries l
            LEFT JOIN media_server_items msi ON l.id = msi.library_id
            WHERE l.is_active = true
            GROUP BY l.id, l.name
            HAVING COUNT(msi.id) > 0 OR EXISTS (SELECT 1 FROM library_profiles lp WHERE lp.library_id = l.id)
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
        const result = await this.db.query(
            `SELECT lp.*, l.media_type
             FROM library_profiles lp
             LEFT JOIN libraries l ON l.id = lp.library_id
             WHERE lp.library_id = $1`,
            [libraryId]
        );
        return result.rows[0] || null;
    }

    async getProfileScore(libraryId, itemMetadata) {
        const { finalScore } = await this.getProfileScoreDetails(libraryId, itemMetadata);
        return finalScore;
    }

    async getProfileScoreDetails(libraryId, itemMetadata) {
        const profile = await this.getProfile(libraryId);
        if (!profile) {
            return {
                rawScore: 0,
                finalScore: 50,
                diagnostics: {
                    schema_version: 1,
                    available: false,
                    reason: 'profile_missing',
                    final_score: 50,
                },
            };
        }

        const { rawScore, finalScore, diagnostics } = computeProfileScoreDetails(profile, itemMetadata);

        logger.debug('Profile score calculated', {
            libraryId,
            rating: itemMetadata.certification || itemMetadata.content_rating,
            genres: normalizeMetadataList(itemMetadata.genres).join(','),
            rawScore,
            finalScore,
            profileDiagnostics: {
                mediaType: diagnostics.media_type,
                rating: diagnostics.rating?.normalized || null,
                ratingDelta: diagnostics.rating?.score_delta || 0,
                genreMatches: diagnostics.genres?.matched?.length || 0,
                keywordMatches: diagnostics.keywords?.matched?.length || 0,
                exclusionHits: (
                    (diagnostics.exclusions?.ratings?.length || 0) +
                    (diagnostics.exclusions?.genres?.length || 0) +
                    (diagnostics.exclusions?.keywords?.length || 0)
                ),
            },
        });

        return { rawScore, finalScore, diagnostics };
    }

    countDistribution(items, field) {
        return _countDistribution(items, field);
    }

    findExclusions(distribution, knownValues) {
        return _findExclusions(distribution, knownValues);
    }

    async getSettingValue(key, defaultValue) {
        try {
            const result = await this.db.query(
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
        return (await readLibraryProfileObservation(this.db, libraryId)).stats;
    }

    async getCertificationDistribution(libraryId) {
        return _getCertificationDistribution(this.db, logger, libraryId);
    }

    async getGenreDistribution(libraryId) {
        return _getGenreDistribution(this.db, logger, libraryId);
    }

    async getStudioDistribution(libraryId) {
        return _getStudioDistribution(this.db, logger, libraryId);
    }

    async getLanguageDistribution(libraryId) {
        return _getLanguageDistribution(this.db, logger, libraryId);
    }

    async getTotalItems(libraryId) {
        return _getTotalItems(this.db, logger, libraryId);
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

export function createLibraryProfileService({ dbClient = db } = {}) {
    return new LibraryProfileService({ dbClient });
}

export const libraryProfileService = createLibraryProfileService();
