/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { INVENTORY_RECOVERY_PAGE, INVENTORY_RECOVERY_LINK_SOURCE } from './inventoryRecoveryReadQuery.mjs';
import { projectInventoryRecovery } from './inventoryRecoveryPresentation.mjs';
import { createPlexLogItemLinks } from './plexLogItemLinks.mjs';
import { readInventoryRecoveryProgress } from './inventoryRecoveryProgressService.mjs';

const sameSource = (a, b) => b && ['item_revision', 'library_revision', 'server_revision']
    .every(key => a[key] === b[key]);

export function createInventoryRecoveryReadService({ db, resolveLinks = createPlexLogItemLinks() }) {
    return {
        progress: (actorId, query) => readInventoryRecoveryProgress(db, actorId, query),
        async list(actorId, query = {}) {
            await requireReviewActor(db, actorId);
            if (Object.keys(query).some(key => key !== 'afterId')) throw new ValidationError('Invalid recovery filter');
            const afterId = query.afterId === undefined ? 0 : reviewInteger(query.afterId);
            const { rows } = await db.query(INVENTORY_RECOVERY_PAGE, [afterId, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
            const row = rows[0], asOf = new Date(row.as_of).toISOString();
            const items = row.items.slice(0, 25).map(item => projectInventoryRecovery(item, asOf));
            return { version: 1, asOf, afterId, pageSize: 25, total: row.total, movies: row.movies, tv: row.tv,
                items, nextCursor: row.items.length > 25 ? items.at(-1).id : null };
        },
        async plexLink(actorId, rawItemId, rawCaseId, query = {}) {
            await requireReviewActor(db, actorId);
            if (Object.keys(query).length) throw new ValidationError('Link lookup does not accept query parameters');
            const itemId = reviewInteger(rawItemId), caseId = reviewPreviewId(rawCaseId);
            const read = async () => (await db.query(INVENTORY_RECOVERY_LINK_SOURCE, [itemId, caseId])).rows[0];
            const source = await read();
            if (!source) throw new NotFoundError('This recovery case is no longer current. Refresh the list.');
            if (source.type !== 'plex') return { status: 'unsupported', url: null };
            let url = null;
            try { [url] = await resolveLinks({ id: source.server_id, url: source.url, api_key: source.api_key }, [source.external_id]); }
            catch { /* A future details read retries; never expose connection errors. */ }
            await requireReviewActor(db, actorId);
            if (!sameSource(source, await read())) throw new ConflictError('The source changed. Refresh the list before opening Plex.');
            return { status: url ? 'available' : 'unavailable', url: url || null };
        },
    };
}
