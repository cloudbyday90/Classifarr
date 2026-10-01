/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { SimpleRateLimiter } from '../services/imageEmbeddingRequestQueue.mjs';
import { embedLocal, embedVertex, fetchImageBase64 } from '../services/imageEmbeddingProviders.mjs';
import { withRetry } from '../utils/retryUtils.mjs';
import { CircuitBreaker, STATES } from '../services/circuitBreaker.mjs';

let server;
let base;
let port;
let onRequest;
let requests;
const logger = { info: jest.fn(), debug: jest.fn() };
beforeAll(async () => {
    server = createServer((req, res) => {
        requests++;
        req.resume();
        res.setHeader('Content-Type', 'application/json');
        onRequest(req, res);
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    port = server.address().port;
    base = `http://127.0.0.1:${port}`;
});
beforeEach(() => { requests = 0; });
afterEach(() => { server.closeAllConnections(); });
afterAll(async () => { await new Promise(resolve => { server.close(resolve); }); });

const cases = [
    ['local inference', signal => embedLocal('https://example.com/poster', {
        image_embedding_local_host: '127.0.0.1', image_embedding_local_port: port,
    }, { model: 'fixture', imageSize: 384, signal }), '{'],
    ['poster download', signal => fetchImageBase64(`${base}/poster`, { signal }), 'poster-partial'],
    ['cloud poster download', signal => embedVertex(`${base}/poster`, {
        apiKey: 'fixture-key', apiEndpoint: base, model: 'fixture', imageSize: 384, signal,
    }), 'poster-partial'],
    ['cloud inference', signal => embedVertex(`${base}/poster`, {
        apiKey: 'fixture-key', apiEndpoint: base, model: 'fixture', imageSize: 384, signal,
    }), '{'],
];

test.each(cases)('%s cancellation closes stalled response and returns queue capacity', async (name, run, partial) => {
    const caller = new AbortController();
    const closed = Promise.withResolvers();
    const started = Promise.withResolvers();
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const breaker = new CircuitBreaker({ logger, halfOpenMaxAttempts: 1 });
    breaker.transitionTo(STATES.HALF_OPEN, 'test recovery');
    onRequest = (req, res) => {
        res.setHeader('Connection', 'close');
        if (name === 'cloud inference' && req.url === '/poster') { res.end('poster'); return; }
        res.on('close', closed.resolve);
        res.write(partial);
        started.resolve();
    };
    const wrapped = withRetry(() => run(caller.signal), { signal: caller.signal, maxRetries: 2 });
    const pending = breaker.run(() => queue.schedule(wrapped, { signal: caller.signal }));
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError', code: 'ABORT_ERR' });
    await started.promise;
    caller.abort('private');
    await rejected;
    await closed.promise;
    expect(requests).toBe(name === 'cloud inference' ? 2 : 1);
    expect(queue.active).toBe(0);
    expect(breaker.halfOpenAttempts).toBe(0);
    expect(breaker.metrics.failedRequests).toBe(0);
    expect(breaker.metrics.successfulRequests).toBe(0);
    onRequest = (_req, res) => { res.setHeader('Connection', 'close'); res.end('{"embedding":[0.1,0.2],"dims":2}'); };
    await expect(breaker.run(() => queue.schedule(() => embedLocal('url', {
        image_embedding_local_host: '127.0.0.1', image_embedding_local_port: port,
    }, { model: 'fixture', imageSize: 384 })))).resolves.toMatchObject({ embedding: [0.1, 0.2] });
    expect(breaker.state).toBe(STATES.CLOSED);
});

test('aborting one active inference leaves a concurrent caller intact', async () => {
    const caller = new AbortController();
    const started = Promise.withResolvers();
    const closed = Promise.withResolvers();
    onRequest = (_req, res) => {
        res.setHeader('Connection', 'close');
        if (requests === 1) {
            res.once('close', closed.resolve);
            started.resolve();
        } else res.end('{"embedding":[0.3],"dims":1}');
    };
    const queue = new SimpleRateLimiter({ concurrency: 2 });
    const config = { image_embedding_local_host: '127.0.0.1', image_embedding_local_port: port };
    const rejected = expect(queue.schedule(() => embedLocal('url', config, {
        model: 'fixture', imageSize: 384, signal: caller.signal,
    }), { signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await started.promise;
    const survivor = queue.schedule(() => embedLocal('url', config, { model: 'fixture', imageSize: 384 }));
    caller.abort();
    await rejected;
    await closed.promise;
    await expect(survivor).resolves.toMatchObject({ embedding: [0.3] });
    expect(queue.active).toBe(0);
    expect(requests).toBe(2);
});

test('a transport timeout remains retryable provider failure, not caller cancellation', async () => {
    const queue = new SimpleRateLimiter({ concurrency: 1 });
    const breaker = new CircuitBreaker({ logger, failureThreshold: 1 });
    const closed = [];
    onRequest = (_req, res) => {
        const connectionClosed = Promise.withResolvers();
        closed.push(connectionClosed.promise);
        res.once('close', connectionClosed.resolve);
    };
    const signal = new AbortController().signal;
    const wrapped = withRetry(() => embedLocal('url', {
        image_embedding_local_host: '127.0.0.1', image_embedding_local_port: port,
        image_embedding_local_timeout_ms: 500,
    }, { model: 'fixture', imageSize: 384, signal }), { signal, maxRetries: 1, baseDelay: 1, jitter: 0 });
    await expect(breaker.run(() => queue.schedule(wrapped, { signal })))
        .rejects.toMatchObject({ code: 'ETIMEDOUT' });
    await Promise.all(closed);
    expect(signal.aborted).toBe(false);
    expect(requests).toBe(2);
    expect(queue.active).toBe(0);
    expect(breaker.metrics.failedRequests).toBe(1);
    expect(breaker.state).toBe(STATES.OPEN);
});
