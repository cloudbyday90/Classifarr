/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { setTimeout as waitFor } from 'node:timers/promises';

// One consumer, one coalesced hint, one timer. Durable queue state remains authoritative.
export function createQueueWorkerWakeup({ wait = (ms, options) => waitFor(ms, undefined, options) } = {}) {
    let pending = false;
    let sleeper = null;

    return {
        acknowledge() { pending = false; },
        notify() {
            pending = true;
            if (sleeper?.interruptible) sleeper.controller.abort();
        },
        cancel() { sleeper?.controller.abort(); },
        async wait(ms, { interruptible = true } = {}) {
            if (sleeper) throw new Error('queue_worker_wait_already_active');
            if (interruptible && pending) return;
            const controller = new AbortController();
            sleeper = { controller, interruptible };
            try {
                await wait(ms, { signal: controller.signal });
            } catch (error) {
                if (!controller.signal.aborted || error?.name !== 'AbortError') throw error;
            } finally {
                sleeper = null;
            }
        },
    };
}
