/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { gatewayError } from './contract.mjs';

/** Operator-owned secret file; parent directories must also be private. */
export async function readGatewayPrivateDocument(path) {
  let file;
  try {
    if (typeof path !== 'string' || !path.trim()) throw gatewayError('gateway_config_invalid');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit operator path, not HTTP input.
    file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 65536 || (process.platform !== 'win32' && (stat.mode & 0o077))) {
      throw gatewayError('gateway_config_invalid');
    }
    const buffer = Buffer.alloc(65537); let length = 0;
    try {
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 65536) throw gatewayError('gateway_config_invalid');
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
    } finally { buffer.fill(0); }
  } catch { throw gatewayError('gateway_config_invalid'); }
  finally { await file?.close(); }
}
