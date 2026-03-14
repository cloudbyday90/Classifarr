/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: Add task_queue(task_type, status) index for live dashboard stats
 *
 * Problem:
 *   queueService.getStats() filters task_queue on task_type = 'classification'
 *   and aggregates by status. Existing indexes optimize dequeue and cleanup,
 *   but not this read path, so high-volume installs can seq-scan tens of
 *   thousands of completed metadata_enrichment rows just to count a handful of
 *   classification tasks.
 *
 * Safe for:
 *   - fresh installs: index is created during initial migration run
 *   - existing installs: index is added automatically on upgrade
 *
 * Notes:
 *   - IF NOT EXISTS keeps the migration idempotent
 *   - regular CREATE INDEX is used because migrations run inside a transaction
 */

CREATE INDEX IF NOT EXISTS idx_task_queue_task_type_status
    ON task_queue (task_type, status);
