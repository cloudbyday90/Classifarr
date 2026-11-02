/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from '../setup.mjs';
import { createReadinessDatabase } from '../../helpers/readinessDatabase.mjs';
import { resourceAdmissionFixture } from '../../helpers/resourceAdmissionFixture.mjs';
import { sourcePairWindowFixture, completedWindowReport } from '../../fixtures/sourcePairWindowFixture.mjs';
import { createAutomaticSourcePairRepository } from '../../../services/automaticSourcePairRepository.mjs';
import { createAutomaticSourcePairEvaluation } from '../../../services/automaticSourcePairEvaluation.mjs';
import { createInventoryDiscoveryAdmission } from '../../../services/inventoryDiscoveryAdmission.mjs';
import { createAdjudicationFinalizationAdmission } from '../../../services/adjudicationFinalizationAdmission.mjs';
import { createAdjudicationBudgetRepository } from '../../../services/adjudicationBudgetRepository.mjs';

export const publicationQuery = (...args) => getPool().query(...args);
export const publicationSnapshot = async () => ({ budget: (await publicationQuery('SELECT * FROM adjudication_capture_budget')).rows,
  cache: (await publicationQuery('SELECT * FROM cached_adjudication_batch')).rows });
export const publicationDeferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
export async function untilPublication(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('publication_fixture_condition_not_reached');
}

const readMemory = () => ({ available: 4e9, constrained: 8e9, total: 8e9 });
function instrument(database) {
  const control = { query: null }, queries = [], spies = [];
  database.pool.on('connect', client => {
    const native = client.query.bind(client);
    spies.push(jest.spyOn(client, 'query').mockImplementation((...args) => {
      queries.push(args);
      return control.query ? control.query(native, args) : native(...args);
    }));
  });
  return { control, queries, restore: () => { for (const spy of spies) spy.mockRestore(); } };
}

/** Real pools, admissions and writes. Only snapshot data/computation are synthetic; no provider. */
export async function createPublicationFixture() {
  const data = await sourcePairWindowFixture(), db = createReadinessDatabase({ max: 4 });
  const captureDb = createReadinessDatabase({ max: 2 }), evaluationIo = instrument(db), captureIo = instrument(captureDb);
  let worker;
  const close = async () => {
    worker?.stop(); evaluationIo.restore(); captureIo.restore();
    await Promise.all([db.pool.end(), captureDb.pool.end()]);
  };
  try {
    const budget = createAdjudicationBudgetRepository(captureDb);
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const evaluationResources = resourceAdmissionFixture(readMemory), captureResources = resourceAdmissionFixture(readMemory);
    const captureAdmission = createAdjudicationFinalizationAdmission({ ...captureDb, readMemory, resourceAdmission: captureResources });
    const repository = createAutomaticSourcePairRepository(db);
    // Exercise publication/admission, not ingestion or the separate quality collector.
    repository.collectQuality = undefined;
    repository.readSnapshot = jest.fn(async () => {
      const current = (await db.query(`SELECT revision,selection_offset,statement_timestamp() AS observed_at
        FROM adjudication_capture_budget WHERE singleton=true`)).rows[0];
      const snapshot = structuredClone(data.snapshot);
      snapshot.observedAt = current.observed_at.toISOString(); snapshot.adjudicationBudgetRevision = current.revision;
      snapshot.inputs.source.adjudicationSelectionOffset = current.selection_offset;
      return snapshot;
    });
    const saveReport = repository.save;
    jest.spyOn(repository, 'save'); jest.spyOn(repository, 'fail');
    const evaluate = jest.fn(async () => ({ fingerprint: data.result.fingerprint,
      report: completedWindowReport(data.result.report), cohort: data.result.cohort, cohortCreatedAt: data.result.cohortCreatedAt }));
    worker = createAutomaticSourcePairEvaluation({ repository, evaluate, withSessionAdvisoryLock: db.withSessionAdvisoryLock,
      withAdmission: createInventoryDiscoveryAdmission({ ...db, readMemory, resourceAdmission: evaluationResources }) });
    const openCheckpoint = async (signal, owner) => {
      const claim = await owner.claimFinalization(state.revision);
      const checkpoint = budget.checkpoint(state.revision, claim.attemptId);
      await checkpoint.open([{ key: 'c'.repeat(64) }], { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
        identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] }, signal);
      await budget.reserve(state.revision, signal, claim.attemptId);
    };
    return { db, captureDb, budget, state, worker, repository, evaluate, saveReport,
      evaluationIo, captureIo, evaluationResources, captureAdmission, openCheckpoint, close };
  } catch (error) { await close(); throw error; }
}
