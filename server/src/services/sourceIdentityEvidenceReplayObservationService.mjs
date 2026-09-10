/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import {
  createSourceIdentityExternalEvidenceReplay,
  SOURCE_IDENTITY_EVIDENCE_REPLAY_LIMITS,
} from './sourceIdentityExternalEvidenceReplay.mjs';
import { createSourceIdentityExternalEvidenceReplayReadService } from './sourceIdentityExternalEvidenceReplayReadService.mjs';
import {
  SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_RETENTION_DAYS,
  toSourceIdentityEvidenceReplayObservation,
} from './sourceIdentityEvidenceReplayObservationContract.mjs';
import {
  deleteExpiredSourceIdentityEvidenceReplayObservations,
  upsertSourceIdentityEvidenceReplayObservation,
} from './sourceIdentityEvidenceReplayObservationRepository.mjs';

function utcDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('Source identity evidence replay observation requires a valid clock.');
  }
  return value.toISOString().slice(0, 10);
}

function cutoffUtcDate(now, retentionDays) {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return utcDate(cutoff);
}

/**
 * Captures one daily, aggregate-only replay receipt. The replay injects the
 * transaction-scoped reader so all external source and TMDb calls occur after
 * the read-only snapshot commits.
 */
export function createSourceIdentityEvidenceReplayObservationService({
  query = db.query,
  withTransaction = db.withTransaction,
  createReader = createSourceIdentityExternalEvidenceReplayReadService,
  createReplay = createSourceIdentityExternalEvidenceReplay,
  project = toSourceIdentityEvidenceReplayObservation,
  upsert = upsertSourceIdentityEvidenceReplayObservation,
  removeExpired = deleteExpiredSourceIdentityEvidenceReplayObservations,
  now = () => new Date(),
  retentionDays = SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_RETENTION_DAYS,
} = {}) {
  if (typeof query !== 'function' || typeof withTransaction !== 'function' ||
      typeof createReader !== 'function' || typeof createReplay !== 'function' ||
      typeof project !== 'function' || typeof upsert !== 'function' || typeof removeExpired !== 'function' ||
      typeof now !== 'function' || !Number.isSafeInteger(retentionDays) || retentionDays < 1) {
    throw new TypeError('Source identity evidence replay observation dependencies are invalid.');
  }

  const reader = createReader({ withTransaction });
  if (!reader || typeof reader.read !== 'function') {
    throw new TypeError('Source identity evidence replay observation requires a replay reader.');
  }
  const replay = createReplay({
    readRows: () => reader.read(SOURCE_IDENTITY_EVIDENCE_REPLAY_LIMITS),
  });
  if (!replay || typeof replay.replay !== 'function') {
    throw new TypeError('Source identity evidence replay observation requires a replay service.');
  }

  return Object.freeze({
    async observe() {
      const observedAt = now();
      const observation = project(await replay.replay());
      await upsert({
        query,
        observedOn: utcDate(observedAt),
        observedAt: observedAt.toISOString(),
        observation,
      });
      return observation;
    },
    async prune() {
      const observedAt = now();
      await removeExpired({
        query,
        cutoffOn: cutoffUtcDate(observedAt, retentionDays),
      });
    },
  });
}

let defaultObservationService;

function getDefaultObservationService() {
  defaultObservationService ??= createSourceIdentityEvidenceReplayObservationService();
  return defaultObservationService;
}

/** Resolves database dependencies only when the fixed scheduled task runs. */
export const sourceIdentityEvidenceReplayObservationService = Object.freeze({
  observe: () => getDefaultObservationService().observe(),
  prune: () => getDefaultObservationService().prune(),
});
