/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { gatewayConfig, gatewayError } from './contract.mjs';

/** Explicit operator-owned path only; callers must keep its parent directory private. */
export async function readGatewayConfiguration(path) {
  if (!path) throw gatewayError('gateway_config_invalid');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit operator-owned secret file, never an HTTP input.
  const file = await open(path,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  let document;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 65536 || (process.platform !== 'win32' && (stat.mode & 0o077))) {
      throw gatewayError('gateway_config_invalid');
    }
    const buffer = Buffer.alloc(65537); let length = 0;
    try {
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer,length,buffer.length-length,null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 65536) throw gatewayError('gateway_config_invalid');
      document = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(buffer.subarray(0,length)));
    } finally { buffer.fill(0); }
  } finally { await file.close(); }
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      Object.keys(document).some(key => !['gateway','database'].includes(key)) || !document.database ||
      typeof document.database !== 'object' || Array.isArray(document.database) ||
      Object.keys(document.database).some(key => !['host','port','database','user','password','ssl'].includes(key)) ||
      ['host','database','user'].some(key => typeof document.database[key] !== 'string' || !document.database[key].trim()) ||
      document.database.ssl?.rejectUnauthorized === false) throw gatewayError('gateway_config_invalid');
  const localDatabase = document.database.host.startsWith('/') || ['127.0.0.1','::1','localhost'].includes(document.database.host);
  if (!localDatabase && document.database.ssl !== true && document.database.ssl?.rejectUnauthorized !== true) {
    throw gatewayError('gateway_config_invalid');
  }
  return { config: gatewayConfig(document.gateway),database: document.database };
}
