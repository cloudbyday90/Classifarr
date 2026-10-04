/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizePresetSavePayload } from '../services/customPresetSavePayload.mjs';

test('normalizes effective content and excludes client ownership and extra fields from the fingerprint', () => {
  const a = normalizePresetSavePayload({ name: ' Test ', signals: { z: [1, null], a: true }, created_by: 20 });
  const b = normalizePresetSavePayload({ signals: { a: true, z: [1, null] }, name: 'Test', created_by: 50, unexpected: 'ignored' });
  expect(a).toEqual(b);
  expect(a.payload).toEqual({ name: 'Test', signals: { a: true, z: [1, null] }, description: null, icon: '⚙️', category: 'custom' });
  expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(normalizePresetSavePayload({ ...a.payload, description: 'changed' }).fingerprint).not.toBe(a.fingerprint);
});

test.each([undefined, null, [], {}, { name: 1 }, { name: '' }, { name: 'x'.repeat(101) },
  { name: 'Test', description: 5 }, { name: 'Test', description: 'x'.repeat(10001) },
  { name: 'Test', icon: null }, { name: 'Test', icon: 'x'.repeat(51) },
  { name: 'Test', category: null }, { name: 'Test', category: 'x'.repeat(51) },
  { name: 'Test', signals: null }, { name: 'Test', signals: [] },
  { name: 'Test', signals: { text: 'x'.repeat(65536) } },
])('rejects invalid or oversized input %#', body => {
  expect(() => normalizePresetSavePayload(body)).toThrow(expect.objectContaining({ statusCode: 400 }));
});

test('limits nesting, including a malicious deeply nested object', () => {
  let signals = {};
  for (let i = 0; i < 40; i++) signals = { inner: signals };
  expect(() => normalizePresetSavePayload({ name: 'Test', signals })).toThrow('deeply nested');
});
