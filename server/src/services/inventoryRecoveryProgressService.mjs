/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ValidationError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from './inventoryBackgroundReadiness.mjs';
import { INVENTORY_RECOVERY_PROGRESS_SQL } from './inventoryRecoveryProgressQuery.mjs';
import { summarizeInventoryRecoveryProgress } from './inventoryRecoveryProgress.mjs';

export async function readInventoryRecoveryProgress(db, actorId, query = {}) {
    await requireReviewActor(db, actorId);
    if (Object.keys(query).length) throw new ValidationError('Progress does not accept filters');
    const report = await db.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout='3s'");
        const { rows: [state] } = await client.query(INVENTORY_BACKGROUND_READINESS_SQL);
        const { rows: [row] } = await client.query(INVENTORY_RECOVERY_PROGRESS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
        return summarizeInventoryRecoveryProgress(row.items, new Date(row.as_of).toISOString(), state.readiness);
    });
    await requireReviewActor(db, actorId);
    return report;
}
