/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const RECONCILIATION_DELAY_MS = 30000;

/** Read-only reconciliation; no catch-up loop and no provider probe admission. */
export function createHealthReconciliationScheduler(reconcile) {
    let active = false;
    let timer = null;
    let pending = null;
    function schedule() {
        if (!active || timer || pending) return;
        timer = setTimeout(() => {
            timer = null;
            pending = Promise.resolve().then(reconcile).catch(() => {
                // swallow-error: configuration reads emit safe unknown diagnostics;
                // an unexpected cycle failure must not create an unhandled rejection.
            }).finally(() => {
                pending = null;
                schedule();
            });
        }, RECONCILIATION_DELAY_MS);
        timer.unref();
    }
    return {
        start() {
            active = true;
            schedule();
        },
        stop() {
            active = false;
            clearTimeout(timer);
            timer = null;
        },
    };
}
