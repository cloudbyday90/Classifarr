/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getEventListeners } from 'node:events';
import { SimpleRateLimiter } from '../services/imageEmbeddingRequestQueue.mjs';

const aborted = { name: 'AbortError', code: 'ABORT_ERR', message: 'Request cancelled' };
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('pre-abort never queues or invokes work', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const fn = jest.fn();
    await expect(queue.schedule(fn, { signal: AbortSignal.abort('private') })).rejects.toMatchObject(aborted);
    expect(fn).not.toHaveBeenCalled();
    expect(queue.active).toBe(0);
    expect(queue.queue).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('removes a cancelled FIFO waiter and its listener while the active request survives', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const active = Promise.withResolvers();
    const first = queue.schedule(() => active.promise);
    const caller = new AbortController();
    const skipped = jest.fn();
    const rejected = expect(queue.schedule(skipped, { signal: caller.signal })).rejects.toMatchObject(aborted);
    const last = jest.fn(() => 'last');
    const following = queue.schedule(last);
    expect(getEventListeners(caller.signal, 'abort')).toHaveLength(1);
    caller.abort({ secret: 'do not expose' });
    await rejected;
    expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0);
    expect(queue.queue).toHaveLength(1);
    expect(queue.active).toBe(1);
    expect(last).not.toHaveBeenCalled();
    active.resolve('first');
    await expect(first).resolves.toBe('first');
    await expect(following).resolves.toBe('last');
    expect(skipped).not.toHaveBeenCalled();
    expect(queue.active).toBe(0);
});

test('cancelled pacing wait clears the sole timer and reserves no future start', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 2, rps: 1 });
    await queue.schedule(() => 'first');
    const caller = new AbortController();
    const skipped = jest.fn();
    const rejected = expect(queue.schedule(skipped, { signal: caller.signal })).rejects.toMatchObject(aborted);
    expect(queue.active).toBe(0);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(300);
    caller.abort();
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
    const next = jest.fn(() => 'next');
    const result = queue.schedule(next);
    await jest.advanceTimersByTimeAsync(699);
    expect(next).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('next');
    expect(skipped).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});

test.each(['resolve', 'reject'])('active cancellation retains capacity until the operation settles: %s', async settle => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const active = Promise.withResolvers();
    const caller = new AbortController();
    const cancelled = expect(queue.schedule(() => active.promise, { signal: caller.signal })).rejects.toMatchObject(aborted);
    const next = jest.fn(() => 'next');
    const result = queue.schedule(next);
    caller.abort('private');
    await jest.advanceTimersByTimeAsync(5000);
    expect(queue.active).toBe(1);
    expect(next).not.toHaveBeenCalled();
    active[settle](settle === 'resolve' ? 'late value' : new Error('late failure'));
    await cancelled;
    await expect(result).resolves.toBe('next');
    expect(queue.active).toBe(0);
});

test('FIFO start spacing and concurrency survive synchronous failure and reentrant scheduling', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 2, rps: 2 });
    const active = Promise.withResolvers();
    const starts = [];
    const first = queue.schedule(() => { starts.push(performance.now()); return active.promise; });
    let nested;
    const failed = expect(queue.schedule(() => {
        starts.push(performance.now());
        nested = queue.schedule(() => { starts.push(performance.now()); return 'nested'; });
        throw new Error('ordinary failure');
    })).rejects.toThrow('ordinary failure');
    await jest.advanceTimersByTimeAsync(500);
    await failed;
    await jest.advanceTimersByTimeAsync(500);
    await expect(nested).resolves.toBe('nested');
    expect(starts[1] - starts[0]).toBe(500);
    expect(starts[2] - starts[1]).toBe(500);
    active.resolve('first');
    await first;
    expect(queue.active).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('success removes signal listener; a late abort cannot cancel the next borrower', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const caller = new AbortController();
    await expect(queue.schedule(() => 42, { signal: caller.signal })).resolves.toBe(42);
    expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0);
    const next = queue.schedule(() => 43);
    caller.abort();
    await expect(next).resolves.toBe(43);
    expect(queue.active).toBe(0);
});

test('a backlog of synchronous failures drains without recursive stack growth', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const active = Promise.withResolvers();
    const first = queue.schedule(() => active.promise);
    const outcomes = Promise.allSettled(Array.from({ length: 5000 }, () => queue.schedule(() => {
        throw new Error('fixture failure');
    })));
    active.resolve();
    await first;
    const results = await outcomes;
    expect(results.every(result => result.status === 'rejected' && result.reason.message === 'fixture failure')).toBe(true);
    expect(queue.queue).toHaveLength(0);
    expect(queue.active).toBe(0);
    expect(queue.draining).toBe(false);
});
