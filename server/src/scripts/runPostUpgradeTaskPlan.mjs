/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/**
 * Description: Print the migrated, read-only post-upgrade task manifest.
 * Usage: cd server && node src/scripts/runPostUpgradeTaskPlan.mjs
 * Environment: standard POSTGRES_* connection settings; no mutation or external API.
 * Exit: 0 on success, 1 if the database or migrated ledger cannot be read.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPostUpgradeTaskPlan } from '../services/postUpgradeTaskPlan.mjs';

async function loadRuntime() {
    process.env.LOG_LEVEL = 'fatal';
    process.env.FILE_LOGGING_ENABLED = 'false';
    const [db, { postUpgradeService }] = await Promise.all([
        import('../config/database.mjs'),
        import('../services/postUpgradeService.mjs')
    ]);
    return {
        withTransaction: db.withTransaction,
        tasks: postUpgradeService.getAllTasks(),
        close: () => db.pool.end()
    };
}

export async function runPostUpgradeTaskPlan({ load = loadRuntime } = {}) {
    const runtime = await load();
    try {
        return await runtime.withTransaction(async client => {
            await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            await client.query("SET LOCAL statement_timeout = '15s'");
            await client.query("SET LOCAL lock_timeout = '1s'");
            const { rows } = await client.query('SELECT task_id FROM post_upgrade_tasks ORDER BY executed_at');
            return buildPostUpgradeTaskPlan(runtime.tasks, rows.map(row => row.task_id));
        });
    } finally {
        await runtime.close();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    runPostUpgradeTaskPlan()
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(() => { process.stderr.write('post_upgrade_task_plan_failed\n'); process.exitCode = 1; });
}
