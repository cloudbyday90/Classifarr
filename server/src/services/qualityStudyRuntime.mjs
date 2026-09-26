/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createQualityEvidenceRepository } from './qualityEvidenceRepository.mjs';
import { collectActiveQualityStudy } from './qualityEvidenceCollector.mjs';
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { runSourcePairQualityThread } from './sourcePairQualityThreadClient.mjs';
import { reportQualityEvidence } from './qualityEvidenceReport.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';

/** Explicit private study lifecycle; registration/collection never authorizes capture or routing. */
export async function runQualityStudyRuntime({ operation, protocol = null, reference = null },
  { signal, logging = LOG_CONFIG, loadDatabase = () => import('../config/database.mjs'), runThread = runSourcePairQualityThread,
    readSnapshot = (database, abort) => createAutomaticSourcePairRepository(database).readSnapshot(abort) } = {}) {
  if (!['start', 'collect', 'report', 'packet', 'stop'].includes(operation) || logging.level !== 'fatal' || logging.fileLoggingEnabled !== false) {
    throw new Error('quality_private_runtime_required');
  }
  const database = await loadDatabase();
  try {
    const study = createQualityEvidenceRepository(database);
    return await createInventoryDiscoveryAdmission(database)(async abort => {
      if (operation === 'stop') {
        if (!protocol) throw new Error('quality_protocol_required');
        const result = await study.stop(protocol, abort); return { stopped: result.rowCount === 1 };
      }
      let state = await study.read(abort);
      if (operation === 'report') {
        if (!state) throw new Error('quality_study_unavailable');
        return { version: 'quality_study_report.v1', studyState: state.status,
          report: reportQualityEvidence(state.evidence, state.protocol, reference) };
      }
      const snapshot = await readSnapshot(database, abort);
      if (operation === 'start') {
        if (!protocol) throw new Error('quality_protocol_required');
        const observation = await runThread(snapshot, protocol, null, { signal: abort, operation: 'collect' });
        state = await study.start(protocol, abort);
        const retained = await study.merge(state, observation, abort);
        if (retained.status !== 'active') throw new Error('quality_study_inactive');
        return protocol;
      }
      if (!state) throw new Error('quality_study_unavailable');
      if (operation === 'packet') {
        if (state.status !== 'active') throw new Error('quality_study_inactive');
        return runThread(snapshot, state.protocol, null, { signal: abort, operation: 'packet' });
      }
      state = await collectActiveQualityStudy(database, snapshot, abort, runThread);
      if (!state) throw new Error('quality_study_unavailable');
      return { version: 'quality_study_report.v1', studyState: state.status,
        report: reportQualityEvidence(state.evidence, state.protocol) };
    }, { signal: AbortSignal.any([AbortSignal.timeout(180000), ...[signal].filter(Boolean)]) });
  } finally { await database.pool.end(); }
}
