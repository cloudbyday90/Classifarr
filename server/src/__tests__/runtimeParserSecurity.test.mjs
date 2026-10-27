/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const probe = fileURLToPath(new URL('./fixtures/compressedParserProbe.mjs', import.meta.url));
const expressRequire = createRequire(import.meta.resolve('express'));
const parserRequire = createRequire(expressRequire.resolve('body-parser'));
const qs = parserRequire('qs');

test.each(['normal-json', 'normal-form', 'restore-json'])('%s contains delayed trailing-byte decoder errors in an isolated process', async mode => {
  const { stdout, stderr } = await run(process.execPath, [probe, mode], {
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', NODE_OPTIONS: '' },
    timeout: 8000, maxBuffer: 64 * 1024, windowsHide: true,
  });
  expect(JSON.parse(stdout)).toEqual({ mode, completed: true });
  expect(stderr).toBe('');
});

test.each([false, true])('comma serialization contains non-callable object coercion with encodeValuesOnly=%s', encodeValuesOnly => {
  const values = [
    JSON.parse('{"toString":"hostile"}'),
    qs.parse('a[0][toString]=hostile', { allowPrototypes: true }).a[0],
    Object.assign(Object.create(null), { key: 'value' }),
    [{ toString: 'hostile' }],
  ];
  for (const value of values) {
    expect(qs.stringify({ a: [value] }, { arrayFormat: 'comma', encodeValuesOnly })).toBe('a=%5Bobject%20Object%5D');
  }
  expect(qs.stringify({ a: [{ toString: 'hostile', valueOf: () => 42 }] }, { arrayFormat: 'comma', encodeValuesOnly })).toBe('a=42');
  expect(qs.stringify({ a: ['one', 'two'] }, { arrayFormat: 'comma', encodeValuesOnly })).toBe(encodeValuesOnly ? 'a=one,two' : 'a=one%2Ctwo');
  expect(qs.stringify({ a: [null, undefined, 'ok'] }, { arrayFormat: 'comma', encodeValuesOnly })).toBe(encodeValuesOnly ? 'a=,,ok' : 'a=%2C%2Cok');
  expect(qs.stringify({ a: [{ toString: () => 'safe' }] }, { arrayFormat: 'comma', encodeValuesOnly })).toBe('a=safe');
  expect(qs.stringify({ a: ['one', 'two'] })).toBe('a%5B0%5D=one&a%5B1%5D=two');
  const failure = new Error('deliberately throwing application coercion');
  expect(() => qs.stringify({ a: [{ toString: () => { throw failure; } }] }, { arrayFormat: 'comma', encodeValuesOnly })).toThrow(failure);
});
