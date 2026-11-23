/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from '@jest/globals';
import express from 'express';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';
import { createSuggestionAnalysisSampler, measureSuggestionAnalysisHttp, summarizeSuggestionAnalysisResults }
  from '../helpers/suggestionAnalysisCapacityMetrics.mjs';

const { prepareSuggestionAnalysisBackground, seedSuggestionAnalysisProfiles } =
  await import('../helpers/suggestionAnalysisCapacityFixtures.mjs');
const { createFeedbackAnalysis } = await import('../../services/feedbackAnalysis.mjs');
const { registerFeedbackAnalysisRoutes } = await import('../../routes/feedbackAnalysisRoutes.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const db = createIntegrationDatabaseModuleMock();

const profiles = {
  small: { policies: 4, keywords: 1, analysis: true, background: false },
  larger: { policies: 24, keywords: 1, analysis: true, background: false },
  richer: { policies: 24, keywords: 8, analysis: true, background: false },
  background: { policies: 24, keywords: 8, analysis: false, background: true },
  combined: { policies: 24, keywords: 8, analysis: true, background: true },
};
const requestedProfile = process.env.CLASSIFARR_TEST_SUGGESTION_ANALYSIS_PROFILE;
const name = requestedProfile ?? 'small';
if (!Object.hasOwn(profiles, name)) throw new Error('invalid_suggestion_analysis_test_profile');
const format = process.env.CLASSIFARR_TEST_SUGGESTION_ANALYSIS_FORMAT ?? 'detailed';
if (!['detailed', 'summary-v1'].includes(format)) throw new Error('invalid_suggestion_analysis_test_format');

test('measures a fixed manual suggestion analysis capacity profile', async () => {
  const profile = profiles[name];
  const background = await prepareSuggestionAnalysisBackground(db);
  const seed = await seedSuggestionAnalysisProfiles(db, profile, background.originalLibraryId);
  const service = createFeedbackAnalysis();
  const token = await generateAccessToken({ id: 1, role: 'admin', username: 'capacity-fixture' });
  const sampler = createSuggestionAnalysisSampler();
  const reportedWrites = new Map();
  let analysisStarted, responseFinished, ready, analysis, output = null, wire = null, counts;

  async function runMeasuredAnalysis(execute, summarize) {
    sampler.mark('analysisStart');
    analysisStarted = performance.now();
    background.resume();
    const result = await execute();
    output = summarize(result);
    for (const policy of result.results) {
      reportedWrites.set(policy.policyId, format === 'summary-v1' ? policy.suggestionsCreated : policy.suggestions.length);
    }
    sampler.mark('beforeSerialization');
    return result;
  }

  function summarizeDetails(result) {
    const details = summarizeSuggestionAnalysisResults(result, seed);
    // Each correction appears in false-positive, missed-positive and new-pattern groups.
    assert.equal(details.feedbackReferences, profile.policies * profile.keywords * (seed.feedbackRows / 2) * 3);
    return details;
  }

  function summarizeBatch(result) {
    assert.equal(result.policiesAttempted, profile.policies);
    assert.deepEqual(result.counts, { completed: profile.policies, insufficient_feedback: 0, unconfirmed: 0 });
    assert.equal(result.nextAfterPolicyId, null);
    assert.deepEqual(result.results.map(entry => entry.policyId), seed.ids.slice().sort((a, b) => a - b));
    assert.ok(result.results.every(entry => entry.feedbackCount === seed.feedbackRows));
    return { policiesAnalyzed: result.policiesAttempted, storedSuggestions: result.results.reduce((count, entry) => count + entry.suggestionsCreated, 0) };
  }

  try {
    sampler.mark('baseline');
    if (profile.background) ready = await background.start();
    if (profile.analysis) {
      const router = express.Router();
      registerFeedbackAnalysisRoutes(router, {
        runFullAnalysis() {
          analysis = runMeasuredAnalysis(() => service.runFullAnalysis(), summarizeDetails);
          return analysis;
        },
        runSummaryAnalysis(afterPolicyId) {
          analysis = runMeasuredAnalysis(() => service.runSummaryAnalysis(afterPolicyId), summarizeBatch);
          return analysis;
        },
      });
      const app = createIntegrationTestApp({ basePath: '/api/feedback', router, middleware: [authenticateToken] });
      ({ wire, finishedAt: responseFinished } = await measureSuggestionAnalysisHttp(app, token, format));
      sampler.mark('afterResponse');
      assert.equal(wire.status, 200);
      assert.ok(wire.responseBytes > 0);
      assert.equal(wire.responseBytes, wire.contentLength);
      if (format === 'summary-v1') assert.ok(wire.responseBytes <= 4096);
    } else {
      background.resume();
    }
    counts = await background.finish();
    sampler.mark('settledWork');
  } finally {
    try {
      const [cleanup] = await Promise.allSettled([background.close(), analysis]);
      if (cleanup.status === 'rejected') throw cleanup.reason;
      sampler.mark('workerCleanup');
    }
    finally { sampler.close(); }
  }

  const { rows: saved } = await db.query(`SELECT policy_id, count(*)::integer AS count FROM policy_tuning_suggestions
    WHERE policy_id=ANY($1::integer[]) GROUP BY policy_id`, [seed.ids]);
  assert.equal(saved.length, profile.analysis ? seed.ids.length : 0);
  for (const row of saved) {
    assert.equal(row.count, profile.keywords + 1);
    assert.equal(row.count, reportedWrites.get(row.policy_id));
  }
  assert.equal(counts.unexpected, 0);
  const { scanCompletedAt, queueCompletedAt } = background.completions();
  assert.equal(queueCompletedAt.length, counts.completed);
  const overlap = profile.analysis && profile.background ? {
    ingestionActiveAtAnalysisStart: ready[0] <= analysisStarted && scanCompletedAt >= analysisStarted,
    queueActiveAtAnalysisStart: ready[1] <= analysisStarted && queueCompletedAt[0] >= analysisStarted,
    ingestionCompletedDuringResponse: scanCompletedAt <= responseFinished,
    queueCompletionsDuringResponse: queueCompletedAt.filter(at => at <= responseFinished).length,
  } : null;
  if (overlap) {
    assert.ok(overlap.ingestionActiveAtAnalysisStart && overlap.queueActiveAtAnalysisStart);
    assert.ok(overlap.ingestionCompletedDuringResponse && overlap.queueCompletionsDuringResponse > 0);
  }
  if (!profile.background) assert.deepEqual(counts, { inventory: 0, completed: 0, enriched: 0, unexpected: 0 });

  if (requestedProfile) process.stdout.write(`SUGGESTION_ANALYSIS_STUDY ${JSON.stringify({ name, format, ...profile,
    feedbackRowsPerPolicy: seed.feedbackRows, output, wire, counts, overlap, memory: sampler.report() })}\n`);
}, 120_000);
