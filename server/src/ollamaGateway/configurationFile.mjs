/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayConfig, gatewayError } from './contract.mjs';
import { readGatewayPrivateDocument } from './privateDocument.mjs';
import { gatewayDatabaseConfiguration } from './databaseConfiguration.mjs';

/** Explicit operator-owned path only; callers must keep its parent directory private. */
export async function readGatewayConfiguration(path) {
  const document = await readGatewayPrivateDocument(path);
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      Object.keys(document).some(key => !['gateway','database'].includes(key))) throw gatewayError('gateway_config_invalid');
  return { config: gatewayConfig(document.gateway),database: gatewayDatabaseConfiguration(document.database) };
}
