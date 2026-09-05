/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as database from '../config/database.mjs';
import { compactInventoryProfileRefreshes, enqueueInventoryProfileRefreshes } from './libraryInventoryProfileRefreshRepository.mjs';

export class LibraryInventoryProfileRefreshPlanner {
    constructor({ dbClient = database } = {}) { this.db = dbClient; }

    async run() {
        return this.db.withTransaction(async client => {
            const compacted = await compactInventoryProfileRefreshes(client);
            const queued = await enqueueInventoryProfileRefreshes(client);
            return { statusId: 'completed', queued, compacted };
        });
    }
}

export const libraryInventoryProfileRefreshPlanner = new LibraryInventoryProfileRefreshPlanner();
