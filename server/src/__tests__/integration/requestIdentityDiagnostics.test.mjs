/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { persistToDb, setDb } from '../../utils/logging/loggerShim.mjs';
import { ClassificationMetadataFailure, classificationMetadataFailureLogFields } from '../../services/classificationMetadataFailure.mjs';
import { REQUEST_IDENTITY_WHITESPACE_SQL } from '../../services/requestIdentitySqlWhitespace.mjs';

test('PostgreSQL competitor trimming agrees with JavaScript, including Unicode whitespace', async () => {
  const padding = Array.from({ length: 65536 }, (_, codePoint) => String.fromCodePoint(codePoint))
    .filter(value => value.trim() === '').join('');
  for (const value of [`${padding}00042${padding}`, `${padding}Movie${padding}`, '4 2', '\u200B42']) {
    expect((await getPool().query(`SELECT btrim($1,${REQUEST_IDENTITY_WHITESPACE_SQL}) AS value`, [value])).rows[0].value)
      .toBe(value.trim());
  }
});

const ids = [];
afterEach(async () => {
  setDb(null);
  if (ids.length) await getPool().query('DELETE FROM error_log WHERE error_id=ANY($1::uuid[])', [ids.splice(0)]);
});

test('persisted bug reports keep safe lookup context and the boundary stack', async () => {
  setDb(getPool());
  const upstream = Object.assign(new Error('https://private.invalid/?api_key=SECRET_FIXTURE'), {
    response: { status: 404, data: 'SECRET_FIXTURE' }, config: { headers: { Authorization: 'SECRET_FIXTURE' } },
  });
  const error = new ClassificationMetadataFailure(upstream, true, { tmdbId: 42, mediaType: 'tv' });
  const fields = classificationMetadataFailureLogFields(error, 123);
  const id = await persistToDb('ERROR', 'classification', 'Classification error', fields, { error });
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  ids.push(id);
  const row = (await getPool().query('SELECT metadata,stack_trace FROM error_log WHERE error_id=$1', [id])).rows[0];
  expect(row.metadata).toMatchObject({ taskId: 123, tmdbId: 42, mediaType: 'tv', provider: 'tmdb',
    operation: 'details', failureReference: fields.failureReference, metadataFailure: { httpStatus: 404 } });
  expect(row.stack_trace).toContain('ClassificationMetadataFailure: Classification metadata lookup failed');
  expect(row.stack_trace).not.toContain('persistToDb');
  expect(JSON.stringify(row)).not.toMatch(/SECRET_FIXTURE|private\.invalid/);
});
