/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Readable } from 'node:stream';
import { readRestoreMaintenanceInput } from './backupRestoreMaintenanceInput.mjs';
import { SELECTED_RESTORE_MAX_BYTES } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';
import { AppError } from '../utils/appError.mjs';

const failure = (status, code) => new AppError('Restore unavailable. Review maintenance status before restarting to try again.',
  status, { code, isOperational: true });

/** Narrow substitute for the backup route; cannot execute SQL restore or generate keys. */
export function createSelectedRestoreBackupService({ files, handoff, audit = async () => {} }) {
  let busy = false, used = false;
  async function exclusive(work) {
    if (busy || used) throw failure(503, 'RESTORE_RESTART_REQUIRED');
    busy = true;
    try { return await work(); } finally { busy = false; }
  }
  async function prepare(filename, password, mode) {
    let bytes;
    try {
      if (!['replace', 'merge'].includes(mode) || (password != null && (typeof password !== 'string' || password.length > 4096))) {
        throw failure(400, 'RESTORE_INPUT_INVALID');
      }
      const backup = await files.read(filename);
      bytes = Buffer.from(JSON.stringify({ version: 1, mode, backup,
        ...(backup?.encrypted === true ? { password } : {}) }));
      if (bytes.length > SELECTED_RESTORE_MAX_BYTES) throw failure(400, 'RESTORE_INPUT_INVALID');
      const request = await readRestoreMaintenanceInput(Readable.from([bytes]));
      return { bytes, backupData: request.backupData };
    } catch { bytes?.fill(0); throw failure(400, 'RESTORE_INPUT_INVALID'); }
  }
  return {
    listBackups: () => exclusive(async () => {
      try { return await files.list(); } catch { throw failure(503, 'RESTORE_CATALOG_UNAVAILABLE'); }
    }),
    readBackup: (filename, password) => exclusive(async () => {
      const { bytes, backupData } = await prepare(filename, password, 'merge');
      bytes.fill(0); return backupData;
    }),
    restoreBackup: (filename, { password, mode = 'replace' } = {}) => exclusive(async () => {
      const { bytes, backupData } = await prepare(filename, password, mode);
      try {
        used = true;
        let result;
        try { result = await handoff.request(bytes); }
        catch { throw failure(503, 'RESTORE_OUTCOME_UNAVAILABLE'); }
        if (result?.status !== 'complete') throw failure(result?.status === 'rejected' ? 400 : 503,
          result?.status === 'deferred' ? 'RESTORE_RUNTIME_BUSY' : 'RESTORE_OUTCOME_UNAVAILABLE');
        const data = backupData.data;
        return { newApiKey: null, stats: { librariesRestored: data.libraries?.length || 0,
          policiesRestored: data.libraryPolicies?.length || 0, rulesRestored: data.libraryCustomRules?.length || 0,
          patternsRestored: data.learningPatterns?.length || 0 } };
      } finally { bytes.fill(0); }
    }),
    async logAudit(...args) { try { await audit(...args); } catch { /* Completed restore is not replayed on audit failure. */ } },
  };
}
