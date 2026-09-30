/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { decryptBackupPayload } from './backupCipher.mjs';
import { validateBackupRestoreReferences } from './backupRestoreReferences.mjs';

/** One bounded stdin envelope. Never accept filenames, SQL, commands or credentials in argv. */
export async function readRestoreMaintenanceInput(input, { maxBytes = 64 * 1024 * 1024, timeoutMs = 10_000 } = {}) {
  const bytes = await new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.off('data', onData);
      input.off('error', onError);
      input.off('end', onEnd);
      input.off('close', onClose);
      input.pause();
      if (error) input.destroy();
      const result = error ? null : Buffer.concat(chunks, size);
      for (const chunk of chunks) chunk.fill(0);
      if (error) reject(new Error('invalid_restore_request'));
      else resolve(result);
    };
    const onData = chunk => {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) { buffer.fill(0); finish(true); }
      else chunks.push(buffer);
    };
    const onError = () => finish(true);
    const onEnd = () => finish(false);
    const onClose = () => finish(true);
    const timer = setTimeout(onError, timeoutMs);
    input.on('data', onData).once('error', onError).once('end', onEnd).once('close', onClose);
    if (input.destroyed || input.readableEnded) finish(true);
  });
  try {
    const request = JSON.parse(bytes.toString('utf8'));
    if (!request || Array.isArray(request) || request.version !== 1
      || !['replace', 'merge'].includes(request.mode)
      || Object.keys(request).some(key => !['version', 'mode', 'backup', 'password'].includes(key))) {
      throw new Error('invalid_restore_request');
    }
    let backupData = request.backup;
    if (backupData?.encrypted === true) {
      if (typeof request.password !== 'string' || !request.password.length || request.password.length > 4096
        || typeof backupData.data !== 'string') throw new Error('invalid_restore_request');
      backupData = decryptBackupPayload(backupData.data, request.password);
    } else if (request.password != null || backupData?.encrypted != null) {
      throw new Error('invalid_restore_request');
    }
    if (!backupData || Array.isArray(backupData) || typeof backupData.version !== 'string'
      || !backupData.version.length || backupData.version.length > 64) throw new Error('invalid_restore_request');
    validateBackupRestoreReferences(backupData.data);
    return { backupData, mode: request.mode };
  } catch {
    // Do not expose parser/decryption errors, which may include backup contents.
    throw new Error('invalid_restore_request');
  } finally { bytes.fill(0); }
}
