/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { buildQueueClassificationHistoryIdentity } from './queueClassificationHistoryContract.mjs';
import {
    buildQueueClassificationHistoryExistsQuery,
    buildQueueClassificationHistoryInsertQuery,
    buildQueueClassificationHistoryReason,
} from './queueClassificationHistoryQueries.mjs';

export class QueueClassificationHistoryService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
    }

    async libraryExists(libraryId) {
        const id = positiveDatabaseInteger(libraryId);
        if (!id) return false;
        const result = await this.db.query('SELECT 1 FROM libraries WHERE id = $1 LIMIT 1', [id]);
        return result.rows.length > 0;
    }

    async #identityExists(identity) {
        const statement = buildQueueClassificationHistoryExistsQuery(identity);
        const result = await this.db.query(statement.text, statement.values);
        return result.rows.length > 0;
    }

    async historyEntryExists(tmdbId, title, libraryId, mediaType) {
        const identity = buildQueueClassificationHistoryIdentity({ title, media_type: mediaType }, tmdbId, libraryId);
        return identity ? this.#identityExists(identity) : false;
    }

    buildReason(tmdbId, sourceLibraryName) {
        return buildQueueClassificationHistoryReason(tmdbId, sourceLibraryName);
    }

    #prepare(payload, tmdbId, libraryId, sourceLibraryName) {
        const identity = buildQueueClassificationHistoryIdentity(payload, tmdbId, libraryId);
        if (!identity) {
            this.logger?.warn('Source-library history skipped', { reason: 'invalid_media_identity' });
            return null;
        }
        // Own all data before the first await, including graph arrays and metadata.
        const snapshot = JSON.parse(JSON.stringify(payload));
        return {
            identity,
            statement: buildQueueClassificationHistoryInsertQuery(
                identity, snapshot, sourceLibraryName, ragGraphExtractor.extract(snapshot),
            ),
        };
    }

    async insertHistoryEntry(payload, tmdbId, sourceLibraryId, sourceLibraryName) {
        const prepared = this.#prepare(payload, tmdbId, sourceLibraryId, sourceLibraryName);
        if (prepared) await this.db.query(prepared.statement.text, prepared.statement.values);
    }

    async persist(payload, tmdbId, sourceLibraryId, sourceLibraryName, _taskId) {
        if (sourceLibraryId === null || sourceLibraryId === undefined) return;
        const prepared = this.#prepare(payload, tmdbId, sourceLibraryId, sourceLibraryName);
        if (!prepared) return;

        if (!await this.libraryExists(prepared.identity.libraryId)) {
            this.logger?.warn('Source-library history skipped', { reason: 'library_unavailable' });
            return;
        }
        if (await this.#identityExists(prepared.identity)) return;
        await this.db.query(prepared.statement.text, prepared.statement.values);
    }
}
