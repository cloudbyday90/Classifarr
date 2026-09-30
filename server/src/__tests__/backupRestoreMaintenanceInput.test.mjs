/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { Readable, PassThrough } from 'node:stream';
import { createCipheriv } from 'node:crypto';
import { readRestoreMaintenanceInput } from '../services/backupRestoreMaintenanceInput.mjs';
import { encryptBackupPayload, decryptBackupPayload, deriveKey } from '../services/backupCipher.mjs';
import { encrypt, decrypt } from '../services/backupEncryption.mjs';

const backup = { version: '2.0', data: { settings: [{ key: 'example', value: 'private' }] } };
const envelope = extra => ({ version: 1, mode: 'replace', backup, ...extra });
const read = (value, options) => readRestoreMaintenanceInput(Readable.from([JSON.stringify(value)]), options);
afterEach(() => jest.useRealTimers());

test('plaintext compatibility and required explicit merge/replace choice', async () => {
  for (const mode of ['merge', 'replace']) expect(await read(envelope({ mode }))).toEqual({ backupData: backup, mode });
});

test('encrypted output is interoperable in both directions with existing backup service', async () => {
  const password = 'synthetic-password';
  expect(decrypt(encryptBackupPayload(backup, password), password)).toEqual(backup);
  expect(decryptBackupPayload(encrypt(backup, password), password)).toEqual(backup);
  expect(await read(envelope({ backup: { encrypted: true, data: encrypt(backup, password) }, password })))
    .toEqual({ backupData: backup, mode: 'replace' });
});

test('historic GCM/PBKDF2 byte layout is preserved independently of the refactored writer', async () => {
  const salt = Buffer.alloc(32, 1), iv = Buffer.alloc(16, 2), password = 'legacy';
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(backup)), cipher.final()]);
  const data = Buffer.concat([salt, iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  expect(await read(envelope({ backup: { encrypted: true, data }, password })))
    .toEqual({ backupData: backup, mode: 'replace' });
});

test.each([null, [], {}, envelope({ version: 2 }), envelope({ mode: null }), envelope({ mode: 'other' }),
  envelope({ filename: '../../secret' }), envelope({ password: 'unused-secret' }), envelope({ backup: null }),
  envelope({ backup: { version: 2, data: {} } }), envelope({ backup: { version: '', data: {} } }),
  envelope({ backup: { version: '2', data: [] } }), envelope({ backup: { encrypted: false } }),
  envelope({ backup: { version: '2', data: { libraryPolicies: [{ library_id: 999 }] } } }),
  envelope({ backup: { encrypted: true, data: 'corrupted' }, password: 'secret' }),
  envelope({ backup: { encrypted: true, data: 'secret' }, password: 5 }),
  envelope({ backup: { encrypted: true, data: 'secret' }, password: 'x'.repeat(4097) }),
  envelope({ backup: { encrypted: true, data: {} }, password: 'secret' }),
])('invalid request is rejected without data in the error (%#)', async value => {
  await expect(read(value)).rejects.toThrow(/^invalid_restore_request$/);
});

test('wrong password, truncated ciphertext and malformed plaintext never return a backup', async () => {
  const data = encryptBackupPayload(backup, 'correct');
  await expect(read(envelope({ backup: { encrypted: true, data }, password: 'wrong' }))).rejects.toThrow('invalid_restore_request');
  await expect(readRestoreMaintenanceInput(Readable.from(['{"private-secret":']))).rejects.toThrow(/^invalid_restore_request$/);
});

test('limits count bytes across chunks and accept a request exactly at its limit', async () => {
  const text = JSON.stringify(envelope({}));
  expect(await readRestoreMaintenanceInput(Readable.from([text.slice(0, 5), text.slice(5)]), { maxBytes: Buffer.byteLength(text) }))
    .toEqual({ backupData: backup, mode: 'replace' });
  await expect(readRestoreMaintenanceInput(Readable.from(['€', '€']), { maxBytes: 5 })).rejects.toThrow('invalid_restore_request');
});

test.each(['timeout', 'error', 'close', 'already-closed'])('input %s rejects and removes listeners', async kind => {
  jest.useFakeTimers();
  const input = new PassThrough();
  if (kind === 'already-closed') input.destroy();
  const assertion = expect(readRestoreMaintenanceInput(input, { timeoutMs: 10 })).rejects.toThrow('invalid_restore_request');
  if (kind === 'error') input.destroy(new Error('private-stream-error'));
  if (kind === 'close') input.destroy();
  if (kind === 'timeout') await jest.advanceTimersByTimeAsync(10);
  await assertion;
  for (const event of ['data', 'error', 'end', 'close']) expect(input.listenerCount(event)).toBe(0);
});
