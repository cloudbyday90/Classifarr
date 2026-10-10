/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { classificationPosterPath, classificationPosterJoinSql, readClassificationPosterPath } from '../services/classificationPosterSelection.mjs';
import { getPendingCount, getPendingEmbeddings } from '../services/embeddingServiceQueries.mjs';

test.each([
  [undefined, null], [null, null], [{}, null],
  [{ poster_path: '/first.jpg', posterPath: '/second.jpg' }, '/first.jpg'],
  [{ poster_path: ' \t\n\r\f\v/trimmed.jpg \t\n\r\f\v' }, '/trimmed.jpg'],
  [{ poster_path: false, posterPath: 'https://fixture.invalid/p.jpg' }, 'https://fixture.invalid/p.jpg'],
  [{ poster_path: 42, posterPath: '/second.jpg' }, '/second.jpg'],
  [{ poster_path: ' ', posterPath: '/second.jpg' }, '/second.jpg'],
  [{ poster_path: {}, posterPath: '/second.jpg' }, '/second.jpg'],
  [{ poster_path: [], posterPath: '/second.jpg' }, '/second.jpg'],
  [{ poster_path: 'javascript:alert(1)' }, null], [{ poster_path: '//fixture.invalid/a' }, null],
  [{ poster_path: '/' }, null], [{ poster_path: 'https://' }, null],
  [{ poster_path: '/with space.jpg' }, null], [{ poster_path: '/with\nnewline.jpg' }, null],
  [{ poster_path: '/with\u0000nul.jpg' }, null], [{ poster_path: '/with\u0085control.jpg' }, null],
  [{ poster_path: '/with\u00a0space.jpg' }, null], [{ poster_path: '/caf\u00e9.jpg' }, '/caf\u00e9.jpg'],
  [{ poster_path: `/${'x'.repeat(4095)}` }, `/${'x'.repeat(4095)}`],
  [{ poster_path: `/${'x'.repeat(4096)}`, posterPath: '/alternate.jpg' }, '/alternate.jpg'],
  [{ poster_path: `/${'é'.repeat(2048)}` }, null],
])('projects supported bounded poster fields: %#', (metadata, expected) => {
  expect(classificationPosterPath(metadata)).toBe(expected);
});

test('keeps SQL identifiers internal and validates the retention placeholder', () => {
  expect(() => classificationPosterJoinSql('30; DROP TABLE media_server_items')).toThrow();
  expect(classificationPosterJoinSql('$2')).toContain('LIMIT 1');
  expect(classificationPosterJoinSql('$2')).toContain('$2::integer');
});

test('single-classification read is parameterized and projects no extra fields', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ poster_path: '/a.jpg', secret: 'private' }] });
  expect(await readClassificationPosterPath(query, 123)).toBe('/a.jpg');
  expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE ch.id=$1'), [123, 30]);
  query.mockResolvedValue({ rows: [] });
  expect(await readClassificationPosterPath(query, 123)).toBeNull();
  query.mockRejectedValue(new Error('database unavailable'));
  await expect(readClassificationPosterPath(query, 123)).rejects.toThrow('database unavailable');
});

test('text-only and disabled work never join artwork inventory', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ count: '0' }] }) };
  const logger = { error: jest.fn() };
  expect(await getPendingCount({ db, logger }, { includeText: false })).toBe(0);
  expect(await getPendingEmbeddings({ db, logger }, { includeText: false })).toEqual([]);
  expect(db.query).not.toHaveBeenCalled();
  await getPendingCount({ db, logger }, { includeImage: false });
  expect(db.query.mock.calls[0][0]).not.toContain('media_server_items');
  expect(db.query.mock.calls[0][1]).toEqual([]);
  db.query.mockResolvedValue({ rows: [] });
  await getPendingEmbeddings({ db, logger }, { limit: 5 });
  expect(db.query.mock.calls[1][0]).not.toContain('media_server_items');
  expect(db.query.mock.calls[1][1]).toEqual([5]);
});
