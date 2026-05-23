import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('SchedulerCrud');

export async function getAllTasks() {
    const result = await db.query(`
      SELECT st.*, l.name as library_name
      FROM scheduled_tasks st
      LEFT JOIN libraries l ON st.library_id = l.id
      ORDER BY st.created_at DESC
    `);
    return result.rows;
}

export async function getTaskById(id) {
    const result = await db.query(
        'SELECT * FROM scheduled_tasks WHERE id = $1',
        [id]
    );
    return result.rows[0];
}

export async function createTask(data) {
    const { name, task_type, library_id, interval_minutes, enabled = true } = data;

    const next_run_at = interval_minutes
        ? new Date(Date.now() + interval_minutes * 60000)
        : null;

    const result = await db.query(`
      INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled, next_run_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, task_type, library_id, interval_minutes, enabled, next_run_at]);

    logger.info('Created scheduled task', { id: result.rows[0].id, name });
    return result.rows[0];
}

export async function updateTask(id, data) {
    const { name, task_type, library_id, interval_minutes, enabled } = data;

    const result = await db.query(`
      UPDATE scheduled_tasks
      SET name = COALESCE($2, name),
          task_type = COALESCE($3, task_type),
          library_id = COALESCE($4, library_id),
          interval_minutes = COALESCE($5, interval_minutes),
          enabled = COALESCE($6, enabled),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, name, task_type, library_id, interval_minutes, enabled]);

    return result.rows[0];
}

export async function deleteTask(id) {
    await db.query('DELETE FROM scheduled_tasks WHERE id = $1', [id]);
    logger.info('Deleted scheduled task', { id });
}

export async function ensureDefaultTasks() {
    const existing = await db.query(
        `SELECT id FROM scheduled_tasks WHERE task_type = 'cleanup_logs' LIMIT 1`
    );
    if (existing.rows.length === 0) {
        const firstRun = new Date();
        firstRun.setDate(firstRun.getDate() + 1);
        firstRun.setHours(2, 30, 0, 0);
        await db.query(`
            INSERT INTO scheduled_tasks (name, task_type, enabled, interval_minutes, next_run_at)
            VALUES ('Log Cleanup', 'cleanup_logs', true, 1440, $1)
        `, [firstRun]);
        logger.info('Seeded default log cleanup task');
    }
}

export async function updateTaskAfterRun(taskId, status, result) {
    const intervalMinutes = await getTaskInterval(taskId);
    const nextRun = intervalMinutes
        ? new Date(Date.now() + intervalMinutes * 60000)
        : null;

    await db.query(`
      UPDATE scheduled_tasks
      SET last_run_at = NOW(),
          next_run_at = $2,
          run_count = run_count + 1,
          last_result = $3,
          updated_at = NOW()
      WHERE id = $1
    `, [taskId, nextRun, JSON.stringify({ status, result: result })]);
}

export async function getTaskInterval(taskId) {
    const result = await db.query(
        'SELECT interval_minutes FROM scheduled_tasks WHERE id = $1',
        [taskId]
    );
    return result.rows[0]?.interval_minutes;
}

export async function getDueTasks() {
    const result = await db.query(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = true
        AND (next_run_at IS NULL OR next_run_at <= NOW())
      ORDER BY next_run_at ASC
      LIMIT 10
    `);
    return result.rows;
}
