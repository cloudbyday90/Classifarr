/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as db from '../config/database.mjs';
import { tmdbService } from './tmdb.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('signalCollectorLookupService');

export class SignalCollectorLookupService {
    constructor(deps = {}) {
        this.db = deps.db || db;
        this.tmdbService = deps.tmdbService || tmdbService;
        this.logger = deps.logger || defaultLogger;
    }

    async checkFranchiseMembership(tmdbId, mediaType) {
        try {
            if (!tmdbId || mediaType !== 'movie') {
                return null;
            }

            const details = await this.tmdbService.getMovieDetails(tmdbId);

            if (details.belongs_to_collection) {
                const collection = details.belongs_to_collection;
                this.logger.debug('Franchise detected', {
                    tmdbId,
                    collectionId: collection.id,
                    collectionName: collection.name,
                });

                return {
                    collectionId: collection.id,
                    collectionName: collection.name,
                    posterPath: collection.poster_path,
                    backdropPath: collection.backdrop_path,
                };
            }

            return null;
        } catch (error) {
            this.logger.warn('Failed to check franchise membership', {
                tmdbId,
                error: error.message,
            });
            return null;
        }
    }

    async findRelatedClassifiedItems(collectionId) {
        try {
            if (!collectionId) return [];

            const result = await this.db.query(
                `SELECT 
          ch.tmdb_id, 
          ch.title, 
          ch.library_id, 
          ch.library_name,
          ch.confidence,
          ch.method,
          ch.created_at
        FROM classification_history ch
        WHERE ch.collection_id = $1
          AND ch.confidence >= 80
        ORDER BY ch.created_at DESC
        LIMIT 10`,
                [collectionId]
            );

            if (result.rows.length > 0) {
                this.logger.debug('Found related classified items', {
                    collectionId,
                    count: result.rows.length,
                });
            }

            return result.rows;
        } catch (error) {
            this.logger.debug('Could not query related items', { error: error.message });
            return [];
        }
    }

    async findExactMatchSignal(classificationEvidenceService, tmdbId, mediaType) {
        if (typeof classificationEvidenceService?.findExactMatch !== 'function') {
            return null;
        }

        const match = await classificationEvidenceService.findExactMatch({ tmdbId, mediaType });
        return match ? { library_id: match.libraryId, confidence: match.confidence } : null;
    }
}

export const signalCollectorLookupService = new SignalCollectorLookupService();
