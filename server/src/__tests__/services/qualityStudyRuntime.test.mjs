/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { createQualityEvidenceRepository } from '../../services/qualityEvidenceRepository.mjs';
import { collectActiveQualityStudy } from '../../services/qualityEvidenceCollector.mjs';
import { runQualityStudyRuntime } from '../../services/qualityStudyRuntime.mjs';

function fixture() {
  const snapshot = qualitySnapshot(), protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  let state = { protocol, protocol_id: protocol.id, evidence: emptyQualityEvidence(protocol), status: 'active',
    generation: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
  const query = jest.fn(async (sql, params) => {
    if (sql.startsWith('SELECT protocol_id')) return { rows: state ? [structuredClone(state)] : [] };
    if (sql.startsWith('DELETE FROM quality_evidence_study WHERE protocol_id')) { state = null; return { rowCount: 1 }; }
    if (sql.includes("SET status='drifted'")) state.status = 'drifted';
    if (sql.includes("SET status='conflicted'")) state.status = 'conflicted';
    if (sql.includes('SET evidence=')) state.evidence = JSON.parse(params[1]);
    return { rows: [], rowCount: 1 };
  });
  const database = { pool: { end: jest.fn() }, withTransaction: fn => fn({ query }),
    withSessionAdvisoryLock: async (_key, fn) => { await fn(); return true; },
    readMemory: () => ({ available: 4e9, constrained: 8e9, total: 8e9 }) };
  const runThread = jest.fn(async () => emptyQualityEvidence(protocol));
  return { snapshot, protocol, database, query, runThread, setState: value => { state = value; },
    dependencies: { logging: { level: 'fatal', fileLoggingEnabled: false }, loadDatabase: async () => database,
      readSnapshot: jest.fn(async () => snapshot), runThread } };
}

test.each(['start', 'collect', 'report', 'packet', 'stop'])('private %s runtime reuses admission and closes its pool', async operation => {
  const { protocol, dependencies, database, runThread } = fixture();
  const result = await runQualityStudyRuntime({ operation, protocol }, dependencies);
  expect(database.pool.end).toHaveBeenCalledTimes(1);
  if (operation === 'start') expect(result).toEqual(protocol);
  if (['report', 'collect'].includes(operation)) expect(result).toMatchObject({ studyState: 'active', report: { status: 'insufficient_reference_labels' } });
  if (operation === 'stop') expect(result).toEqual({ stopped: true });
  if (['stop', 'report'].includes(operation)) { expect(runThread).not.toHaveBeenCalled(); expect(dependencies.readSnapshot).not.toHaveBeenCalled(); }
});

test.each(['quality_cohort_changed', 'quality_evidence_changed'])('known %s drift stops collection without losing historical evidence', async reason => {
  const { database, snapshot, runThread } = fixture(); runThread.mockRejectedValue(new Error(reason));
  expect((await collectActiveQualityStudy(database, snapshot, undefined, runThread)).status).toBe('drifted');
  expect((await createQualityEvidenceRepository(database).read()).status).toBe('drifted');
  await collectActiveQualityStudy(database, snapshot, undefined, runThread);
  expect(runThread).toHaveBeenCalledTimes(1);
});

test('transient failure propagates and preserves an active study, while absence avoids a worker', async () => {
  const { database, snapshot, runThread, setState } = fixture(); runThread.mockRejectedValue(new Error('temporary failure'));
  await expect(collectActiveQualityStudy(database, snapshot, undefined, runThread)).rejects.toThrow('temporary failure');
  expect((await createQualityEvidenceRepository(database).read()).status).toBe('active');
  setState(null); expect(await collectActiveQualityStudy(database, snapshot, undefined, runThread)).toBeNull();
  expect(runThread).toHaveBeenCalledTimes(1);
});

test('runtime always closes on absent, inactive, aborted or failed work', async () => {
  for (const operation of ['report', 'collect', 'packet']) {
    const { dependencies, database, setState } = fixture(); setState(null);
    await expect(runQualityStudyRuntime({ operation }, dependencies)).rejects.toThrow('quality_study_unavailable');
    expect(database.pool.end).toHaveBeenCalledTimes(1);
  }
  const { dependencies, database } = fixture();
  await expect(runQualityStudyRuntime({ operation: 'start' }, dependencies)).rejects.toThrow('quality_protocol_required');
  await expect(runQualityStudyRuntime({ operation: 'stop' }, dependencies)).rejects.toThrow('quality_protocol_required');
  await expect(runQualityStudyRuntime({ operation: 'report' }, { ...dependencies, signal: AbortSignal.abort() })).rejects.toThrow();
  expect(database.pool.end).toHaveBeenCalledTimes(3);
});

test('private runtime guard and stored contracts fail closed', async () => {
  const { dependencies, database, setState } = fixture(), loadDatabase = jest.fn();
  await expect(runQualityStudyRuntime({ operation: 'report' }, { ...dependencies, logging: { level: 'info' }, loadDatabase })).rejects.toThrow('quality_private_runtime_required');
  expect(loadDatabase).not.toHaveBeenCalled();
  setState({ protocol: {} });
  await expect(createQualityEvidenceRepository(database).read()).rejects.toThrow('quality_study_invalid');
  expect(() => createQualityEvidenceRepository(database).start({})).toThrow('quality_protocol_invalid');
  expect(() => createQualityEvidenceRepository(database).stop({})).toThrow('quality_protocol_invalid');
});
