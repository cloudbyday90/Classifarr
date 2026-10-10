/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { createComparisonIncidentLedger } from '../../../services/comparisonIncidentLedger.mjs';
import { createComparisonRecoveryScope } from '../../../services/comparisonRecoveryScope.mjs';
import { createDatabaseClientLease } from '../../../utils/databaseClientLease.mjs';
import { COMPARISON_INCIDENT_LOCK } from '../../../services/comparisonIncidentSession.mjs';

// The parent kills this process only after the durable commit receipt.
try {
  const options = JSON.parse(process.env.COMPARISON_FIXTURE_DATABASE);
  if (!/^classifarr_suite_[a-f0-9]{12}$/.test(options.database) || options.user !== 'test' ||
      !['127.0.0.1', 'localhost', '::1'].includes(options.host)) throw new Error('fixture required');
  const pool = new pg.Pool({ ...options, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 3000 });
  const client = await pool.connect(), lease = createDatabaseClientLease(client);
  if (!(await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [COMPARISON_INCIDENT_LOCK])).rows[0].acquired) {
    throw new Error('fixture lock busy');
  }
  const ledger = await createComparisonIncidentLedger({ signal: lease.signal,
    query: (...args) => client.query(...args) }, () => true);
  const scope = createComparisonRecoveryScope(); scope.configure('private endpoint');
  scope.identify({ provider: 'ollama', model: 'fixture', digest: 'a'.repeat(64), dimensions: 4 });
  await ledger.prepare(scope.fingerprint(ledger.secret), false);
  const mode = process.argv[2];
  if (!['warn', 'recover'].includes(mode)) throw new Error('invalid fixture mode');
  const result = mode === 'warn'
    ? await ledger.warn({ code: 'cached_vectors_incomplete', coverage: { missingDescriptions: 1 } })
    : await ledger.recover({ status: 'ready' });
  process.on('disconnect', () => process.exit(0));
  process.send({ ok: true, result });
} catch { process.send({ ok: false }, () => process.exit(1)); }
