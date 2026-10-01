/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { throwIfCancelled } from '../utils/requestCancellation.mjs';

/** FIFO image admission. Active slots belong to operations, not waiting callers. */
export class SimpleRateLimiter {
    constructor({ concurrency, rps }) {
        this.concurrency = Math.max(1, concurrency || 1);
        this.minIntervalMs = rps ? Math.max(1, Math.floor(1000 / rps)) : 0;
        this.active = 0;
        this.queue = [];
        this.lastStart = -Infinity;
        this.timer = null;
        this.draining = false;
    }

    async schedule(fn, { signal } = {}) {
        throwIfCancelled(signal);
        return new Promise((resolve, reject) => {
            const item = { fn, signal, resolve, reject, cleanup: () => {} };
            const cancel = () => {
                const index = this.queue.indexOf(item);
                if (index < 0) return;
                this.queue.splice(index, 1);
                item.cleanup();
                try { throwIfCancelled(signal); } catch (error) { reject(error); }
                this.drain();
            };
            item.cleanup = () => signal?.removeEventListener('abort', cancel);
            signal?.addEventListener('abort', cancel, { once: true });
            this.queue.push(item);
            this.drain();
        });
    }

    drain() {
        if (this.draining) return;
        this.draining = true;
        try {
            clearTimeout(this.timer);
            this.timer = null;
            while (this.active < this.concurrency && this.queue.length > 0) {
                const waitMs = Math.max(0, this.minIntervalMs - (performance.now() - this.lastStart));
                if (waitMs > 0) {
                    this.timer = setTimeout(() => this.drain(), waitMs);
                    return;
                }
                const item = this.queue.shift();
                item.cleanup();
                this.lastStart = performance.now();
                this.active++;
                void this.run(item);
            }
        } finally {
            this.draining = false;
        }
    }

    async run({ fn, signal, resolve, reject }) {
        try {
            throwIfCancelled(signal);
            const result = await fn();
            throwIfCancelled(signal);
            resolve(result);
        } catch (error) {
            // Normalize late failures too; never expose a caller's abort reason.
            try { throwIfCancelled(signal); } catch (cancelled) { error = cancelled; }
            reject(error);
        } finally {
            this.active--;
            this.drain();
        }
    }
}
