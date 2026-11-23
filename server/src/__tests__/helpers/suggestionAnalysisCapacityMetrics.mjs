/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { performance } from 'node:perf_hooks';

export function createSuggestionAnalysisSampler() {
  const phases = {};
  const start = performance.now();
  let samples = 0, sampledHeapBytes = 0, sampledRssBytes = 0;
  function sample() {
    const { rss, heapUsed } = process.memoryUsage();
    sampledRssBytes = Math.max(sampledRssBytes, rss);
    sampledHeapBytes = Math.max(sampledHeapBytes, heapUsed);
    samples++;
    return { elapsedMs: Math.round(performance.now() - start), rssBytes: rss, heapBytes: heapUsed,
      lifetimePeakRssBytes: process.resourceUsage().maxRSS * 1024 };
  }
  const interval = setInterval(sample, 20);
  return {
    mark(phase) { phases[phase] = sample(); },
    report() { return { phases, samples, sampledHeapBytes, sampledRssBytes }; },
    close() { clearInterval(interval); },
  };
}

/** Count exact wire bytes while leaving the response body unbuffered. */
export async function measureSuggestionAnalysisHttp(app, token) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    return await new Promise((resolve, reject) => {
      const start = performance.now();
      const request = httpRequest({ hostname: '127.0.0.1', port: server.address().port,
        method: 'POST', path: '/api/feedback/analyze-all', signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': '2' },
      }, response => {
        let responseBytes = 0;
        response.on('data', chunk => { responseBytes += chunk.length; });
        response.once('error', reject);
        response.once('end', () => {
          const finishedAt = performance.now();
          resolve({ finishedAt, wire: { status: response.statusCode, responseBytes,
            contentLength: Number(response.headers['content-length']), durationMs: Math.round(finishedAt - start) } });
        });
      });
      request.once('error', reject);
      request.end('{}');
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
  }
}

export function summarizeSuggestionAnalysisResults(result, { ids, feedbackRows }) {
  assert.equal(result.policiesAnalyzed, ids.length);
  assert.equal(result.results.length, ids.length);
  const seen = new Set();
  let feedbackReferences = 0, storedSuggestions = 0;
  for (const entry of result.results) {
    assert.ok(ids.includes(entry.policyId) && !seen.has(entry.policyId));
    assert.equal(entry.feedbackCount, feedbackRows);
    assert.equal(entry.error, undefined);
    seen.add(entry.policyId);
    const { failurePatterns, newPatterns } = entry.analysis;
    for (const group of [...failurePatterns.falsePositives, ...failurePatterns.missedPositives, ...newPatterns]) {
      feedbackReferences += group.feedbackIds.length;
    }
    storedSuggestions += entry.suggestions.length;
  }
  assert.ok(feedbackReferences > 0 && storedSuggestions > 0);
  return { policiesAnalyzed: seen.size, feedbackReferences, storedSuggestions };
}
