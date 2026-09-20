/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareCrossEncoderEvidence, createCrossEncoderExclusionDiagnostics } from './inventoryCrossEncoderAdmission.mjs';
import { createLocalCrossEncoderClient } from './localCrossEncoderClient.mjs';
import { runCrossEncoderTrial } from './inventoryCrossEncoderTrial.mjs';
import { DiscoveryDeferredError } from './inventoryDiscoveryAdmission.mjs';

export function validateCrossEncoderCases(value, size = 300) {
  if (!Number.isSafeInteger(value) || value < 0 || value > Math.min(100, size)) throw new Error('cross_encoder_cases_invalid');
  return value;
}
/** Source-order retention then library/media round-robin, fixed before observing any model output. */
export function createCrossEncoderEvaluation({ scoreCases = 0, createClient = createLocalCrossEncoderClient } = {}) {
  validateCrossEncoderCases(scoreCases);
  const pending = [], diagnostics = createCrossEncoderExclusionDiagnostics();
  let considered = 0, bytes = 0;
  return {
    add(input) {
      considered++;
      const { plan, reason } = prepareCrossEncoderEvidence(input);
      if (!plan) { diagnostics.record(reason, input?.metadata?.media_type ?? input?.mediaType); return; }
      const size = Buffer.byteLength(JSON.stringify(plan));
      if (pending.length >= 300 || bytes + size > 8_000_000) { diagnostics.record('retention_budget', plan.query.mediaType); return; }
      bytes += size;
      pending.push({ plan, observed: [...input.observed], baselineId: input.baselineId });
    },
    async run({ signal, checkpoint = () => {}, onProgress = () => {}, onScoringCall = () => {} } = {}) {
      const groups = new Map();
      for (const row of pending) {
        const key = `${row.plan.query.mediaType}:${[...row.observed].sort((a, b) => a - b).join(',')}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      const rows = [], orderedGroups = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
      while (rows.length < scoreCases && orderedGroups.some(group => group.length)) {
        for (const group of orderedGroups) if (group.length && rows.length < scoreCases) rows.push(group.shift());
      }
      let client, identity, calls = 0, completed = 0, failed = false, maxDelta = 0;
      const latencies = [], statuses = {}, failureReasons = {}, languages = {}, libraries = new Set();
      const perMedia = Object.fromEntries(['movie', 'tv'].map(type => [type, { attempted: 0, supported: 0, baselineAgreement: 0, scorerAgreement: 0, gains: 0, losses: 0 }]));
      for (const row of rows) {
        checkpoint(); signal?.throwIfAborted();
        const stratum = perMedia[row.plan.query.mediaType]; stratum.attempted++;
        let status;
        try {
          client ??= createClient();
          const trial = await runCrossEncoderTrial(row.plan, { client, signal, checkpoint, onScoringCall: () => { calls++; onScoringCall(); } });
          status = trial.status; identity = trial.identity; maxDelta = Math.max(maxDelta, trial.maxDelta); latencies.push(...trial.latencies);
          if (status === 'supported') {
            stratum.supported++;
            const before = row.observed.includes(row.baselineId), after = row.observed.includes(trial.winner);
            stratum.baselineAgreement += Number(before); stratum.scorerAgreement += Number(after);
            stratum.gains += Number(!before && after); stratum.losses += Number(before && !after);
          }
          if (status === 'unstable') failed = true;
        } catch (error) {
          signal?.throwIfAborted();
          if (error instanceof DiscoveryDeferredError) throw error;
          const known = ['cross_encoder_overloaded', 'cross_encoder_input_rejected', 'cross_encoder_identity_invalid',
            'cross_encoder_response_invalid', 'cross_encoder_timeout', 'cross_encoder_transport_unavailable'];
          const reason = known.includes(error?.message) ? error.message : 'cross_encoder_unavailable';
          failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
          status = 'provider_failed'; failed = true;
        }
        statuses[status] = (statuses[status] ?? 0) + 1; completed++;
        const language = ['en', 'zh'].includes(row.plan.query.language) ? row.plan.query.language : 'other_or_unknown';
        languages[language] = (languages[language] ?? 0) + 1;
        row.observed.forEach(id => libraries.add(id));
        onProgress({ stage: 'cross_encoder_comparison', completed, requested: scoreCases, calls });
        checkpoint(); signal?.throwIfAborted();
        if (failed) break;
      }
      latencies.sort((a, b) => a - b);
      const p95BatchLatencyMs = latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null;
      return { status: failed ? 'completed_with_errors' : scoreCases ? 'complete' : 'preflight', considered, eligible: pending.length, ...diagnostics.report(),
        requested: scoreCases, selected: rows.length, completed, shortfall: scoreCases - completed,
        statuses, failureReasons, perMedia, originalLanguageCounts: languages, descriptionLanguageAssessed: false,
        observedLibraries: libraries.size, calls, identity: identity ?? null,
        maxPairDelta: maxDelta, p95BatchLatencyMs, latencyGatePassed: p95BatchLatencyMs !== null && p95BatchLatencyMs <= 5000,
        cacheBypassed: true, independentLabels: 0, accuracy: null, livePromotionAllowed: false };
    },
  };
}
