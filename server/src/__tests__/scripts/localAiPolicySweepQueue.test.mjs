/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildClassificationQueueDecisionWitness } from '../../services/classificationQueueDecisionWitness.mjs';

const run = promisify(execFile);
const runner = fileURLToPath(new URL('../../../../scripts/local-ai-policy-sweep.mjs', import.meta.url));
const fixture = {
  version: 'classifarr.ai_classification_evaluation_fixture.v1',
  id: 'queue-sweep-owned-fixture',
  name: 'Queue sweep owned fixture',
  tags: ['movie'],
  request: { tmdbId: 550, mediaType: 'movie', title: 'Owned fixture' },
  expected: { fallbackAllowed: false, outcomes: [{
    decisionKind: 'clarification', methods: ['ai_analysis'], historyStatuses: ['awaiting_decision'],
  }] },
};

function witnessResponse(queueTaskId, classificationId) {
  return {
    available: true,
    queueTaskId,
    classificationId,
    decisionWitness: buildClassificationQueueDecisionWitness({
      queueTaskId,
      result: { method: 'ai_analysis', needs_clarification: true },
      persistenceState: { status: 'awaiting_decision' },
    }),
    history: { id: classificationId, status: 'awaiting_decision', method: 'ai_analysis',
      confidence: 63, libraryId: null, libraryName: null },
  };
}

async function runQueuedSweep({ mode, taskId, adjacentId, responses, timeoutMs }) {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-queue-sweep-'));
  const fixturesPath = join(directory, 'fixtures.json');
  const reportPath = join(directory, 'report.json');
  const witnessPaths = [];
  const logId = 77;
  const submissionPath = mode === 'requests' ? '/api/requests/submit' : '/api/webhook/overseerr';
  const routes = new Map([
    ['GET /api/settings/ai', { primary_provider: 'ollama' }],
    ['PUT /api/settings/ai', {}],
    ['GET /api/libraries', [{ id: 4, name: 'Movies' }]],
    ['GET /api/classification/history', { data: [] }],
    ['GET /api/settings', { require_all_confirmations: true }],
    ['PUT /api/settings', {}],
    ['GET /api/policies/evaluation-context', {}],
    [`POST ${submissionPath}`, { success: true, queued: true, taskId, logId, message: 'Queued' }],
    ['GET /api/queue/pending', [{ id: taskId, status: 'processing' }]],
    ['GET /api/queue/failed', [{ id: adjacentId, status: 'failed' }]],
    ['GET /api/settings/webhook/logs', { logs: [{ id: logId, processing_status: 'completed' }] }],
  ]);
  const server = createServer((req, res) => {
    req.resume();
    const { pathname } = new URL(req.url, 'http://127.0.0.1');
    let payload = routes.get(`${req.method} ${pathname}`);
    if (req.method === 'GET' && pathname.endsWith('/decision-witness')) {
      const index = Math.min(witnessPaths.length, responses.length - 1);
      witnessPaths.push(pathname);
      payload = responses[index];
    }
    res.writeHead(payload ? 200 : 404, { 'Content-Type': 'application/json', ETag: '"fixture-ai-settings"' });
    res.end(JSON.stringify(payload ?? {}));
  });
  try {
    await writeFile(fixturesPath, JSON.stringify([fixture]));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const code = await run(process.execPath, [runner,
      '--base-url', `http://127.0.0.1:${server.address().port}`, '--ingest-mode', mode,
      '--token', 'owned-fixture-access', '--webhook-key', 'owned-fixture-webhook',
      '--fixtures', fixturesPath, '--output', reportPath, '--include-existing-fixtures',
      '--history-poll-interval-ms', '100', '--history-timeout-ms', String(timeoutMs),
    ], { timeout: 7000, env: { SystemRoot: process.env.SystemRoot } }).then(() => 0, error => {
      if (typeof error.code === 'number') return error.code;
      throw error;
    });
    return { code, report: JSON.parse(await readFile(reportPath, 'utf8')), witnessPaths };
  } finally {
    if (server.listening) {
      await new Promise(resolve => { server.close(resolve); });
    }
    await rm(fixturesPath, { force: true });
    await rm(reportPath, { force: true });
    await rmdir(directory);
  }
}

test('queued request CLI ignores unbound evidence and reports the exact large task and History IDs', async () => {
  const taskId = '9007199254740993';
  const adjacentId = '9007199254740992';
  const bound = witnessResponse(taskId, '9223372036854775807');
  const other = witnessResponse(adjacentId, '9007199254740993');
  const { code, report, witnessPaths } = await runQueuedSweep({ mode: 'requests', taskId, adjacentId, timeoutMs: 3000,
    responses: [{ ...bound, queueTaskId: adjacentId }, { ...other, queueTaskId: taskId },
      { ...bound, history: other.history }, bound] });
  expect(code).toBe(0);
  expect(witnessPaths).toEqual(Array(4).fill(`/api/queue/tasks/${taskId}/decision-witness`));
  expect(report.summary).toMatchObject({ evaluatedCount: 1, evaluationPassCount: 1, byHistoryStatus: { awaiting_decision: 1 } });
  expect(report.results[0]).toMatchObject({
    submissionResponse: { taskId, logId: 77 }, lifecycle: { taskId, queueStatuses: ['processing'], logId: 77 },
    queueDecisionWitness: { queueTaskId: taskId, classificationId: bound.classificationId, fingerprint: bound.decisionWitness.fingerprint },
    historyRow: { id: bound.classificationId }, evaluation: { status: 'evaluated' }, validationIssues: [],
  });
});

test('webhook CLI excludes a valid v1 witness for a different task from the report and evaluation', async () => {
  const taskId = 19;
  const adjacentId = 20;
  const other = witnessResponse(adjacentId, 44);
  const { code, report, witnessPaths } = await runQueuedSweep({ mode: 'webhook-overseerr', taskId, adjacentId, timeoutMs: 1000,
    responses: [{ ...other, queueTaskId: taskId }] });
  expect(code).toBe(1);
  expect(witnessPaths.length).toBeGreaterThan(1);
  expect(new Set(witnessPaths)).toEqual(new Set([`/api/queue/tasks/${taskId}/decision-witness`]));
  expect(report.summary).toMatchObject({ evaluatedCount: 0, evaluationNotEvaluatedCount: 1, byHistoryStatus: {} });
  expect(report.results[0]).toMatchObject({
    submissionResponse: { taskId, logId: 77 }, historyRow: null, queueDecisionWitness: null,
    evaluation: { status: 'not_evaluated' },
  });
});
