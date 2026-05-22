/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import os from 'node:os';
import v8 from 'node:v8';
import * as db from '../config/database.mjs';

const WORKER_STALL_THRESHOLD_MS = 10 * 60 * 1000;

export function checkProcessMemory() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let heapCapMb = null;
    try {
        heapCapMb = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
    } catch (_) {
        // v8 module unavailable in some environments
    }

    const heapUsedMb  = Math.round(mem.heapUsed  / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMb       = Math.round(mem.rss       / 1024 / 1024);
    const totalMemMb  = Math.round(totalMem / 1024 / 1024);
    const freeMemMb   = Math.round(freeMem  / 1024 / 1024);
    const usedMemMb   = Math.round(usedMem  / 1024 / 1024);

    const heapUsedPct = heapCapMb ? Math.round((heapUsedMb / heapCapMb) * 100) : null;
    const osUsedPct   = totalMemMb ? Math.round((usedMemMb  / totalMemMb) * 100) : null;

    let status = 'ok';
    if (heapCapMb && heapUsedPct >= 90) status = 'critical';
    else if (osUsedPct !== null && osUsedPct >= 95) status = 'critical';
    else if (heapCapMb && heapUsedPct >= 75) status = 'warning';
    else if (osUsedPct !== null && osUsedPct >= 85) status = 'warning';

    return {
        status,
        process: {
            heapUsedMb,
            heapTotalMb,
            heapCapMb,
            heapUsedPct,
            rssMb
        },
        os: {
            totalMemMb,
            freeMemMb,
            usedMemMb,
            usedPct: osUsedPct
        },
        timestamp: new Date().toISOString()
    };
}

export async function checkQueueWorker() {
    try {
        const result = await db.query(
            `SELECT
                 SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                 MAX(started_at) AS last_activity
             FROM task_queue
             WHERE status IN ('pending', 'processing')
                OR (status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour')`
        );

        const processingCount = parseInt(result.rows[0].processing) || 0;
        const pendingCount = parseInt(result.rows[0].pending) || 0;
        const lastActivity = result.rows[0].last_activity;

        let status = 'connected';
        if (lastActivity) {
            const lastActivityTime = new Date(lastActivity);
            const stallThreshold = new Date(Date.now() - WORKER_STALL_THRESHOLD_MS);
            if (lastActivityTime < stallThreshold && pendingCount > 0) {
                status = 'degraded';
            }
        }

        return {
            name: 'Queue Worker',
            status,
            latency: 0,
            timestamp: new Date().toISOString(),
            metadata: {
                processing: processingCount,
                pending: pendingCount,
                lastActivity: lastActivity
            }
        };
    } catch (error) {
        return {
            name: 'Queue Worker',
            status: 'disconnected',
            latency: 0,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}