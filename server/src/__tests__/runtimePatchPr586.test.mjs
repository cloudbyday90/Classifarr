/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
async function probe(file, mode) {
  const { stdout, stderr } = await run(process.execPath, [fileURLToPath(new URL(`./fixtures/${file}`, import.meta.url)), mode], {
    timeout: 8000, maxBuffer: 32768, windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'test' },
  });
  expect(JSON.parse(stdout)).toEqual({ mode, passed: true }); expect(stderr).toBe('');
}
test.each(['integrity', 'headers', 'hops', 'credentials', 'revalidation', 'replay'])(
  'installed standalone Undici preserves %s through real local HTTP', mode => probe('runtimePatchUndiciProbe.mjs', mode));
test.each(['handler', 'message', 'sync-message', 'ordinary'])(
  'installed rate limiter forwards %s without admitting another request', mode => probe('rateLimitAsyncFailureProbe.mjs', mode));
test('real Discord SDK keeps resolved channel permissions interaction-scoped and preserves outgoing payloads',
  () => probe('discordInteractionScopeProbe.mjs', 'interactions'));
