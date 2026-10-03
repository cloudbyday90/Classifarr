/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPublishedRoutingAcceptance } from '../../../../scripts/lib/publishedRoutingAcceptance.mjs';
import { validatePublishedRoutingMatrix, validatePublishedRoutingReceipt } from '../../../../scripts/lib/publishedRoutingReceipt.mjs';
import { publishedRoutingMain } from '../../../../scripts/run-published-routing-acceptance.mjs';
import { SOURCE, IMAGE, NOW, WORKFLOW, ENV, receipt } from '../helpers/publishedRoutingFixture.mjs';

const expected = { image: IMAGE, sourceRevision: SOURCE, platform: 'linux/amd64', workflow: WORKFLOW, now: NOW };
describe('published routing acceptance', () => {
  test('real CLI exits nonzero without echoing unsafe input', () => {
    const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../../../../scripts/run-published-routing-acceptance.mjs'),
      '--image', 'PRIVATE_PROVIDER_PAYLOAD'], { encoding: 'utf8', shell: false, timeout: 10_000, maxBuffer: 64 * 1024 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('published_routing_input_invalid');
    expect(result.stderr + result.stdout).not.toContain('PRIVATE_PROVIDER_PAYLOAD');
  });

  test('identity failure prevents baseline builds and returns a fixed diagnostic', async () => {
    const withBaseline = jest.fn();
    await expect(runPublishedRoutingAcceptance(expected, { resolveSubject: () => { throw new Error('PRIVATE'); }, withBaseline }))
      .rejects.toThrow('published_routing_identity_failed');
    expect(withBaseline).not.toHaveBeenCalled();
  });
  test('borrows resolved candidate and waits for baseline cleanup', async () => {
    const evidence = receipt(), events = [];
    const result = await runPublishedRoutingAcceptance(expected, {
      resolveSubject: () => evidence.subject,
      withBaseline: async operation => { const result = await operation(evidence.routing.baseline.imageId); events.push('cleanup'); return result; },
      rehearse: async ({ baseline, candidate }) => { events.push(candidate); return { ...evidence.routing, baseline, candidate }; },
      now: () => { events.push('receipt'); return NOW; },
    });
    expect(result).toEqual(evidence);
    expect(events).toEqual([evidence.subject.imageId, 'cleanup', 'receipt']);
  });
  test('baseline cleanup failure cannot produce success', async () => {
    const now = jest.fn();
    await expect(runPublishedRoutingAcceptance(expected, { resolveSubject: () => receipt().subject,
      withBaseline: async () => { throw new Error('cleanup failed'); }, now })).rejects.toThrow('published_routing_rehearsal_failed');
    expect(now).not.toHaveBeenCalled();
  });
  test.each([
    value => { value.status = 'blocked'; },
    value => { value.schemaVersion = 'old'; },
    value => { value.subject.image = IMAGE.replace(/a/g, 'b'); },
    value => { value.subject.imageId = `sha256:${'f'.repeat(64)}`; },
    value => { value.subject.sourceRevision = '0'.repeat(40); },
    value => { value.subject.platform = 'linux/arm64'; },
    value => { value.subject.provenance.verified = false; },
    value => { value.workflow.runId = '999'; },
    value => { value.workflow.runAttempt = '1'; },
    value => { value.completedAt = '2026-08-08T00:00:00.000Z'; },
    value => { value.completedAt = '2026-08-10T00:00:00.000Z'; },
    value => { value.routing.cleanup = 'failed'; },
    value => { value.routing.checks.pop(); },
    value => { value.routing.checks[0] = value.routing.checks[1]; },
    value => { value.routing.providerWrites = 1; },
    value => { value.routing.movieGets = 3; },
    value => { value.routing.baseline.revision = SOURCE; },
    value => { value.rawProviderData = 'PRIVATE'; },
  ])('rejects incomplete or mismatched receipts', mutate => {
    const value = receipt(); mutate(value);
    expect(() => validatePublishedRoutingReceipt(value, expected)).toThrow();
  });
  test('requires both native architectures exactly once', () => {
    const amd = receipt(), arm = receipt('linux/arm64');
    expect(validatePublishedRoutingMatrix([arm, amd], expected)).toEqual([amd, arm]);
    for (const value of [undefined, [], [amd], [amd, amd], [amd, arm, arm]]) {
      expect(() => validatePublishedRoutingMatrix(value, expected)).toThrow();
    }
  });
  test('CLI rejects wrong context and replaces stale success with blocked evidence', async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), 'published-routing-'));
    const args = ['--image', IMAGE, '--source-revision', SOURCE, '--platform', 'linux/amd64'];
    const path = resolve(cwd, '.tmp/published-routing/amd64.json');
    const run = jest.fn((_binary, args) => ({ status: 0, stdout: args[0] === 'rev-parse' ? SOURCE : '' }));
    const accept = jest.fn(async () => receipt());
    try {
      await expect(publishedRoutingMain(args, { cwd, env: {}, run, accept })).rejects.toThrow();
      expect(existsSync(path)).toBe(false);
      expect(accept).not.toHaveBeenCalled();
      await publishedRoutingMain(args, { cwd, env: ENV, run, accept });
      expect(JSON.parse(readFileSync(path, 'utf8')).status).toBe('passed');
      accept.mockRejectedValueOnce(new Error('PRIVATE'));
      await expect(publishedRoutingMain(args, { cwd, env: ENV, run, accept })).rejects.toThrow();
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ schemaVersion: 'classifarr.release.published-routing.v1', status: 'blocked', failureStage: 'published_routing_acceptance_failed' });
      run.mockReturnValue({ status: 0, stdout: 'dirty' });
      accept.mockClear();
      await expect(publishedRoutingMain(args, { cwd, env: ENV, run, accept })).rejects.toThrow();
      expect(accept).not.toHaveBeenCalled();
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});
