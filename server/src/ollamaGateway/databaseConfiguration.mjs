/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';

export function gatewayDatabaseConfiguration(database) {
  if (!database || typeof database !== 'object' || Array.isArray(database) ||
      Object.keys(database).some(key => !['host','port','database','user','password','ssl'].includes(key)) ||
      ['host','database','user'].some(key => typeof database[key] !== 'string' || !database[key].trim()) ||
      database.ssl?.rejectUnauthorized === false) throw gatewayError('gateway_config_invalid');
  const local = database.host.startsWith('/') || ['127.0.0.1','::1','localhost'].includes(database.host);
  if (!local && database.ssl !== true && database.ssl?.rejectUnauthorized !== true) {
    throw gatewayError('gateway_config_invalid');
  }
  return database;
}
