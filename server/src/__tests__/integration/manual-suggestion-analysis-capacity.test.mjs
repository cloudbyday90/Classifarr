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

test('measures a fixed manual suggestion analysis capacity profile', async () => {
  const profile = profiles[name];
  const background = await prepareSuggestionAnalysisBackground(db);
  const seed = await seedSuggestionAnalysisProfiles(db, profile, background.originalLibraryId);
  const service = createFeedbackAnalysis();
  const token = await generateAccessToken({ id: 1, role: 'admin', username: 'capacity-fixture' });
  const sampler = createSuggestionAnalysisSampler();
  let analysisStarted, responseFinished, ready, analysis, output = null, wire = null, counts;

  async function runMeasuredAnalysis() {
    sampler.mark('analysisStart');
    analysisStarted = performance.now();
    background.resume();
    const result = await service.runFullAnalysis();
    output = summarizeSuggestionAnalysisResults(result, seed);
    // The seeded corrections each appear in false-positive, missed-positive and new-pattern groups.
    assert.equal(output.feedbackReferences, profile.policies * profile.keywords * (seed.feedbackRows / 2) * 3);
    sampler.mark('beforeSerialization');
    return result;
  }

  try {
    sampler.mark('baseline');
    if (profile.background) ready = await background.start();
    if (profile.analysis) {
      const router = express.Router();
      registerFeedbackAnalysisRoutes(router, {
        runFullAnalysis() {
          analysis = runMeasuredAnalysis();
          return analysis;
        },
      });
      const app = createIntegrationTestApp({ basePath: '/api/feedback', router, middleware: [authenticateToken] });
      ({ wire, finishedAt: responseFinished } = await measureSuggestionAnalysisHttp(app, token));
      sampler.mark('afterResponse');
      assert.equal(wire.status, 200);
      assert.ok(wire.responseBytes > 0);
      assert.equal(wire.responseBytes, wire.contentLength);
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

  const saved = await db.query(`SELECT count(*)::integer AS count FROM policy_tuning_suggestions WHERE policy_id=ANY($1::integer[])`, [seed.ids]);
  assert.equal(saved.rows[0].count, output?.storedSuggestions ?? 0);
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

  if (requestedProfile) process.stdout.write(`SUGGESTION_ANALYSIS_STUDY ${JSON.stringify({ name, ...profile,
    feedbackRowsPerPolicy: seed.feedbackRows, output, wire, counts, overlap, memory: sampler.report() })}\n`);
}, 120_000);
