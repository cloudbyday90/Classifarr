/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validQualityProtocol } from './sourcePairQualityContract.mjs';
import { validQualityEvidence, emptyQualityEvidence } from './qualityEvidenceContract.mjs';
import { mergeQualityEvidence } from './qualityEvidenceMerge.mjs';

export const PRUNE_QUALITY_STUDY_SQL = 'DELETE FROM quality_evidence_study WHERE created_at>statement_timestamp() OR expires_at<=statement_timestamp()';
const readSql = `SELECT protocol_id,protocol,evidence,status,generation FROM quality_evidence_study
  WHERE created_at<=statement_timestamp() AND expires_at>statement_timestamp()`;
function validated(row) {
  if (!row) return null;
  if (!validQualityProtocol(row.protocol) || row.protocol_id !== row.protocol.id || !validQualityEvidence(row.evidence, row.protocol) ||
      !['active', 'drifted', 'conflicted'].includes(row.status) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.generation)) throw new Error('quality_study_invalid');
  return row;
}
export function createQualityEvidenceRepository(database) {
  const transaction = (callback, signal) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    await client.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='1s'");
    const result = await callback(client); signal?.throwIfAborted(); return result;
  });
  return {
    read: signal => transaction(async client => validated((await client.query(readSql)).rows[0]), signal),
    start: (protocol, signal) => {
      if (!validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid');
      return transaction(async client => {
        await client.query(PRUNE_QUALITY_STUDY_SQL);
        await client.query(`INSERT INTO quality_evidence_study(singleton,protocol_id,protocol,evidence,created_at,expires_at)
          SELECT true,$1,$2::jsonb,$3::jsonb,$4::timestamptz,$4::timestamptz+interval '720 hours'
          WHERE $4::timestamptz<=statement_timestamp() AND $4::timestamptz+interval '720 hours'>statement_timestamp()
          ON CONFLICT(singleton) DO NOTHING`, [protocol.id, JSON.stringify(protocol), JSON.stringify(emptyQualityEvidence(protocol)), protocol.createdAt]);
        const state = validated((await client.query(readSql)).rows[0]);
        if (state?.protocol_id !== protocol.id || state.status !== 'active') throw new Error('quality_study_exists_or_expired');
        return state;
      }, signal);
    },
    merge: (state, observation, signal) => transaction(async client => {
      const current = validated((await client.query(`${readSql} FOR UPDATE`)).rows[0]); // sql-interpolation: readSql is a fixed module-local query, never caller input.
      if (!current || current.generation !== state.generation || current.protocol_id !== state.protocol_id || current.status !== 'active') throw new Error('quality_study_changed');
      let evidence;
      try { evidence = mergeQualityEvidence(current.evidence, observation, current.protocol); }
      catch (error) {
        if (error.message !== 'quality_evidence_conflict') throw error;
        await client.query("UPDATE quality_evidence_study SET status='conflicted' WHERE generation=$1", [current.generation]);
        return { ...current, status: 'conflicted' };
      }
      await client.query('UPDATE quality_evidence_study SET evidence=$2::jsonb WHERE generation=$1', [current.generation, JSON.stringify(evidence)]);
      return { ...current, evidence };
    }, signal),
    drift: (state, signal) => transaction(client => client.query("UPDATE quality_evidence_study SET status='drifted' WHERE generation=$1 AND status='active'", [state.generation]), signal),
    stop: (protocol, signal) => {
      if (!validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid');
      return transaction(client => client.query('DELETE FROM quality_evidence_study WHERE protocol_id=$1', [protocol.id]), signal);
    },
  };
}
