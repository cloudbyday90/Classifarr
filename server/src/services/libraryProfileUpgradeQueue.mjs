/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as database from '../config/database.mjs';

/**
 * Record upgrade intent and dirty library revisions in one transaction.
 * The existing inventory refresh planner and leased worker perform the costly
 * per-library reads after startup. Replaying an already recorded task is inert.
 */
export async function queueLibraryProfileUpgrade(task, dbClient = database) {
    if (!task?.id || !task?.version || !task?.description) {
        throw new TypeError('A registered upgrade task is required');
    }

    return dbClient.withTransaction(async client => {
        const recorded = await client.query(`
            INSERT INTO post_upgrade_tasks (task_id, version, description, executed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (task_id) DO NOTHING RETURNING task_id
        `, [task.id, task.version, task.description]);
        if (recorded.rowCount === 0) return { queued: 0, alreadyRecorded: true };

        const queued = await client.query(`
            INSERT INTO library_profile_inventory_state (library_id)
            SELECT library.id FROM libraries library
            WHERE (
                EXISTS (SELECT 1 FROM media_server_items item WHERE item.library_id = library.id)
                OR EXISTS (SELECT 1 FROM library_profiles profile WHERE profile.library_id = library.id)
            )
            ORDER BY library.id
            ON CONFLICT (library_id) DO UPDATE
            SET revision = library_profile_inventory_state.revision + 1,
                changed_at = clock_timestamp()
        `);
        return { queued: queued.rowCount, alreadyRecorded: false };
    });
}
