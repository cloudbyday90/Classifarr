/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { createQualityEvidenceRepository, PRUNE_QUALITY_STUDY_SQL } from '../../services/qualityEvidenceRepository.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { qualityProtocolId } from '../../services/sourcePairQualityContract.mjs';

const database = { withTransaction: async callback => {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
} };
let protocol, study;
beforeEach(async () => {
  await getPool().query('TRUNCATE quality_evidence_study');
  const snapshot = qualitySnapshot(); snapshot.observedAt = new Date().toISOString();
  protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  study = createQualityEvidenceRepository(database);
});
const automatic = (index, value = emptyQualityEvidence(protocol)) => {
  const row = value.cases[index], target = protocol.destinations.find(entry => entry.mediaType === row.mediaType).target;
  row.arms = [0, 1].map(() => ({ status: 'automatic', target, gap: 'none', requestKey: null, responseHash: null }));
  return value;
};

test('concurrent row-locked merges preserve disjoint observations and never renew expiry', async () => {
  const state = await study.start(protocol);
  const before = (await getPool().query('SELECT expires_at FROM quality_evidence_study')).rows[0];
  await Promise.all([study.merge(state, automatic(0)), study.merge(state, automatic(1))]);
  const stored = await study.read();
  expect(stored.evidence.cases.slice(0, 2).every(row => row.arms.every(arm => arm.status === 'automatic'))).toBe(true);
  expect((await getPool().query('SELECT expires_at FROM quality_evidence_study')).rows[0]).toEqual(before);
  expect(await study.start(protocol)).toEqual(stored);
});

test('stop/start generation fence rejects old collectors; conflicts commit a stopped study', async () => {
  const old = await study.start(protocol); expect((await study.stop(protocol)).rowCount).toBe(1);
  const state = await study.start(protocol); expect(state.generation).not.toBe(old.generation);
  await expect(study.merge(old, automatic(0))).rejects.toThrow('quality_study_changed');
  await study.drift(old); expect((await study.read()).status).toBe('active');
  await study.merge(state, automatic(0));
  const changed = automatic(0), row = changed.cases[0];
  row.arms[0].target = protocol.destinations.find(entry => entry.mediaType === row.mediaType && entry.target !== row.arms[0].target).target;
  expect((await study.merge(state, changed)).status).toBe('conflicted');
  expect((await study.read()).status).toBe('conflicted');
  await expect(study.start(protocol)).rejects.toThrow('quality_study_exists_or_expired');
});

test('aborted and invalid observations roll back; known drift preserves historical evidence', async () => {
  const state = await study.start(protocol), observation = automatic(0);
  await expect(study.merge(state, observation, AbortSignal.abort(new Error('cancelled')))).rejects.toThrow('cancelled');
  await expect(study.merge(state, { ...observation, secret: 'never persist' })).rejects.toThrow('quality_observation_invalid');
  expect((await study.read()).evidence).toEqual(state.evidence);
  await study.drift(state); expect((await study.read()).status).toBe('drifted');
  await expect(study.merge(state, observation)).rejects.toThrow('quality_study_changed');
});

test('expiry is fixed at 720 hours, cannot be revived, and prune affects only the study', async () => {
  await study.start(protocol);
  await getPool().query("UPDATE quality_evidence_study SET created_at=now()-interval '31 days',expires_at=now()-interval '31 days'+interval '720 hours'");
  expect(await study.read()).toBeNull();
  expect((await getPool().query(PRUNE_QUALITY_STUDY_SQL)).rowCount).toBe(1);
  protocol.createdAt = new Date(Date.now() - 31 * 86400000).toISOString(); protocol.id = qualityProtocolId(protocol);
  await expect(study.start(protocol)).rejects.toThrow('quality_study_exists_or_expired');
  expect((await getPool().query('SELECT count(*)::int AS total FROM quality_evidence_study')).rows[0].total).toBe(0);
});

test('migration is idempotent and SQL constraints bound rows and payloads', async () => {
  const migration = await readFile(new URL('../../../../database/migrations/20260926_100000_add_quality_evidence_study.sql', import.meta.url), 'utf8');
  await getPool().query(migration); await getPool().query(migration);
  await study.start(protocol);
  await expect(getPool().query("UPDATE quality_evidence_study SET singleton=false")).rejects.toThrow();
  await expect(getPool().query("UPDATE quality_evidence_study SET status='promoted'")).rejects.toThrow();
  await expect(getPool().query("UPDATE quality_evidence_study SET expires_at=created_at+interval '721 hours'")).rejects.toThrow();
  await expect(getPool().query("UPDATE quality_evidence_study SET evidence='[]'::jsonb")).rejects.toThrow();
});
