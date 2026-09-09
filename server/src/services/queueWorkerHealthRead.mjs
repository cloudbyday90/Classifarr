/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/**
 * Keep the two independently indexable queue windows separate. This preserves
 * the health contract while avoiding an OR predicate that scans historic rows.
 */
export const QUEUE_WORKER_HEALTH_READ_SQL = `
    WITH active_queue AS MATERIALIZED (
        SELECT COUNT(*) FILTER (WHERE status = 'processing') AS processing,
               COUNT(*) FILTER (WHERE status = 'pending') AS pending,
               MAX(started_at) AS last_activity
        FROM task_queue
        WHERE status IN ('pending', 'processing')
    ), recent_completed_queue AS MATERIALIZED (
        SELECT MAX(started_at) AS last_activity
        FROM task_queue
        WHERE status = 'completed'
          AND completed_at > NOW() - INTERVAL '1 hour'
    )
    SELECT active_queue.processing,
           active_queue.pending,
           GREATEST(active_queue.last_activity, recent_completed_queue.last_activity) AS last_activity
    FROM active_queue
    CROSS JOIN recent_completed_queue`;
