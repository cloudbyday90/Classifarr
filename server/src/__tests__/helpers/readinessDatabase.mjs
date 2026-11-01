/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { jest } from '@jest/globals';
import { getPool } from '../integration/setup.mjs';

jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');

/** Production cancellation/ownership adapter, connected only to the isolated suite database. */
export function createReadinessDatabase({ max = 2, statementMs = 30000, Client = pg.Client } = {}) {
  const config = getPool().options;
  return createDatabaseModule({ pgModule: { ...pg, Client },
    loggerFactory: () => ({ warn: jest.fn(), error: jest.fn() }),
    environment: { POSTGRES_HOST: config.host, POSTGRES_PORT: String(config.port), POSTGRES_DB: config.database,
      POSTGRES_USER: config.user, POSTGRES_PASSWORD: config.password, POSTGRES_POOL_MAX: String(max),
      POSTGRES_STATEMENT_TIMEOUT_MS: String(statementMs), POSTGRES_CONN_TIMEOUT_MS: '20000' } });
}
