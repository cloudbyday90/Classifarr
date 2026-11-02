/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';

export const fixtureAttemptId = '41db1265-8bc1-4ab3-992f-885799a4af1d';
export const seedFixtureReservationAuthority = (database, revision) => database.query(
  'UPDATE adjudication_capture_budget SET finalization_attempt_id=$1::uuid WHERE revision=$2', [fixtureAttemptId,revision]);

/** Explicit synthetic claim for isolated quota/finish SQL tests, not ownership proof. */
export function createFinalizationFixtureBudget(database) {
  const repository = createAdjudicationBudgetRepository(database);
  return { ...repository,
    async configure(options) {
      const state = await repository.configure(options);
      await database.query('UPDATE adjudication_capture_budget SET finalization_attempt_id=$1::uuid WHERE revision=$2',
        [fixtureAttemptId, state.revision]);
      return state;
    },
    reserve: (revision, signal, attemptId = fixtureAttemptId) => repository.reserve(revision, signal, attemptId),
    checkpoint: (revision, attemptId = fixtureAttemptId) => repository.checkpoint(revision, attemptId),
    advance: (revision, eligible, signal, attemptId = fixtureAttemptId) => repository.advance(revision, eligible, signal, attemptId),
    finish: (revision, status, fingerprint, signal, attemptId = fixtureAttemptId) =>
      repository.finish(revision, status, fingerprint, signal, attemptId),
  };
}
