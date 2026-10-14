/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayConfig, gatewayError } from './contract.mjs';
import { readGatewayPrivateDocument } from './privateDocument.mjs';

/** Explicit operator-owned path only; callers must keep its parent directory private. */
export async function readGatewayConfiguration(path) {
  const document = await readGatewayPrivateDocument(path);
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
