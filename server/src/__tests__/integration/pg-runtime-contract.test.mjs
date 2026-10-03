/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';

test('a query config remains reusable across callback and promise calls', async () => {
  const client = await getPool().connect();
  try {
    const config = { text: 'SELECT $1::integer AS value' };
    const first = await new Promise((resolve, reject) => {
      client.query(config, [7], (error, result) => error ? reject(error) : resolve(result));
    });
    expect(first.rows).toEqual([{ value: 7 }]);
    expect(config).toEqual({ text: 'SELECT $1::integer AS value' });
    expect((await client.query(config, [8])).rows).toEqual([{ value: 8 }]);
  } finally {
    client.release();
  }
});

test('extended protocol preserves mixed parameters across serializer buffer growth', async () => {
  const text = 'synthetic-😀-漢字'.repeat(1000);
  const bytes = Buffer.from([0, 255, 1, 128]);
  const when = new Date('2026-10-03T00:00:00.000Z');
  const data = { title: "quote' and slash\\", values: [1, null] };
  const result = await getPool().query(
    'SELECT $1::text AS text, $2::bytea AS bytes, $3::text AS empty, $4::jsonb AS data, $5::timestamptz AS date, $6::int[] AS numbers',
    [text, bytes, null, data, when, [1, 2, 3]],
  );
  expect(result.rows).toEqual([{ text, bytes, empty: null, data, date: when, numbers: [1, 2, 3] }]);
});

test('connection errors are still surfaced after a successful parameterized query', async () => {
  const client = await getPool().connect();
  let timer;
  try {
    await client.query('SELECT $1::integer AS value', [1]);
    const received = new Promise((resolve, reject) => {
      client.once('error', resolve);
      timer = setTimeout(() => reject(new Error('connection_error_not_forwarded')), 3000);
    });
    // Inject at the socket boundary after a real extended-protocol round trip.
    // This is deterministic fault injection, not a claim to simulate TCP timing.
    client.connection.stream.emit('error', Object.assign(new Error('synthetic reset'), { code: 'ECONNRESET' }));
    await expect(received).resolves.toMatchObject({ code: 'ECONNRESET' });
  } finally {
    clearTimeout(timer);
    client.release(true);
  }
  expect((await getPool().query('SELECT 1 AS ok')).rows).toEqual([{ ok: 1 }]);
});
