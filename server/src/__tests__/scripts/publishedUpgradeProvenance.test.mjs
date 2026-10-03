/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { verifyPublishedUpgradeProvenance, upgradeBaseline, PublishedUpgradeProvenanceError,
  provenanceFailureDiagnostic, readProvenanceFailure } from '../../../../scripts/lib/publishedUpgradeProvenance.mjs';
import { runRuntimeInstallationAcceptance } from '../../../../scripts/run-runtime-installation-acceptance.mjs';
import { runInstallationWithRouting } from '../../../../scripts/lib/installationRoutingAcceptance.mjs';
import { createRuntimeInstallationReceipt, formatRuntimeInstallationSummary } from '../../../../scripts/lib/runtimeInstallationReceipt.mjs';

function failure(result, env = {}) {
  const run = jest.fn(() => result);
  try { verifyPublishedUpgradeProvenance({ run, env, cwd: '/isolated/repo' }); }
  catch (error) { return { error, diagnostic: readProvenanceFailure(error), run }; }
  throw new Error('expected_verification_failure');
}

test('fixed provenance policy is bounded, non-interactive and does not change credential precedence', () => {
  const env = { GH_TOKEN: 'private-gh', GITHUB_TOKEN: 'private-github', GH_DEBUG: 'api', DEBUG: 'true', PATH: '/bin' };
  const original = { ...env };
  const run = jest.fn(() => ({ status: 0, stdout: 'verified' }));
  expect(verifyPublishedUpgradeProvenance({ run, env, cwd: '/isolated/repo' })).toBeUndefined();
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0]).toBe('gh');
  expect(run.mock.calls[0][1]).toEqual(['attestation', 'verify', `oci://${upgradeBaseline.image}`,
    '--repo', 'cloudbyday90/Classifarr', '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml',
    '--source-digest', upgradeBaseline.revision, '--deny-self-hosted-runners', '--hostname', 'github.com']);
  expect(run.mock.calls[0][2]).toEqual({ cwd: '/isolated/repo', encoding: 'utf8', shell: false, windowsHide: true,
    timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    env: { GH_TOKEN: 'private-gh', GITHUB_TOKEN: 'private-github', PATH: '/bin', GH_PROMPT_DISABLED: '1', NO_COLOR: '1' } });
  expect(env).toEqual(original);
});

test.each([
  [{ GH_TOKEN: 'private', GITHUB_TOKEN: 'private' }, 'GH_TOKEN'],
  [{ GH_TOKEN: '', GITHUB_TOKEN: 'private' }, 'GITHUB_TOKEN'], [{}, 'stored_cli'],
])('authentication failure identifies only the selected credential source (%j)', (env, source) => {
  const result = failure({ status: 1, stdout: '', stderr: 'HTTP 401: Bad credentials (token=private)' }, env);
  expect(result.diagnostic).toMatchObject({ reason: 'authentication_failed', credentialSource: source });
  expect(JSON.stringify(result.error)).not.toContain('private');
  expect(result.run).toHaveBeenCalledTimes(1);
  expect(result.diagnostic.nextStep).toContain('gh auth status');
});

test.each([
  [{ error: { code: 'ENOENT', message: 'private' } }, 'cli_missing'],
  [{ error: { code: 'ETIMEDOUT', message: 'private' } }, 'command_timeout'],
  [{ status: 1, stderr: 'HTTP 403: private' }, 'access_or_rate_limit'],
  [{ status: 1, stderr: 'HTTP 429: private' }, 'access_or_rate_limit'],
  [{ status: 1, stderr: 'rate limit exceeded for private' }, 'access_or_rate_limit'],
  [{ status: 1, stderr: 'Please run gh auth login to authenticate' }, 'authentication_failed'],
  [{ status: 1, stderr: 'HTTP 404: no attestations, private' }, 'verification_failed'],
  [{ status: 1, stderr: 'signer mismatch private' }, 'verification_failed'],
  [{ status: 1, stderr: 'private' }, 'verification_failed'],
  [{ status: null }, 'verification_failed'], [undefined, 'verification_failed'],
  [{ status: 0 }, 'verification_failed'],
  [{ status: 0, stdout: '', error: { code: 'ETIMEDOUT' } }, 'command_timeout'],
])('known failures stay distinct, unknown failures never pass (%#)', (result, reason) => {
  const value = failure(result);
  expect(value.diagnostic.reason).toBe(reason);
  expect(JSON.stringify(value.error)).not.toContain('private');
});

test.each(['ENOENT', 'ETIMEDOUT', 'UNKNOWN'])('thrown process errors retain only recognised classifications: %s', code => {
  let thrown;
  const run = jest.fn(() => { throw Object.assign(new Error('private'), { code }); });
  try { verifyPublishedUpgradeProvenance({ run, env: {} }); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(PublishedUpgradeProvenanceError);
  expect(readProvenanceFailure(thrown).reason).toBe(code === 'ENOENT' ? 'cli_missing' : code === 'ETIMEDOUT' ? 'command_timeout' : 'verification_failed');
  expect(JSON.stringify(thrown)).not.toContain('private');
  expect(thrown.cause).toBeUndefined();
});

test('reports reconstruct safe fields instead of serializing supplied next-step text', () => {
  const diagnostic = { reason: 'authentication_failed', credentialSource: 'GITHUB_TOKEN', nextStep: 'private', raw: 'private' };
  const receipt = createRuntimeInstallationReceipt({ provenanceFailure: diagnostic });
  expect(JSON.stringify(receipt)).not.toContain('private');
  expect(formatRuntimeInstallationSummary({ ...receipt, provenanceFailure: diagnostic })).not.toContain('private');
  expect(formatRuntimeInstallationSummary(receipt)).toContain('GITHUB_TOKEN overrides stored CLI credentials');
  expect(() => provenanceFailureDiagnostic({ reason: 'private', credentialSource: 'GITHUB_TOKEN' })).toThrow();
  expect(() => provenanceFailureDiagnostic({ reason: 'authentication_failed', credentialSource: 'private' })).toThrow();
  expect(() => createRuntimeInstallationReceipt({ provenanceFailure: diagnostic, failureStage: 'cleanup' })).toThrow();
  expect(() => createRuntimeInstallationReceipt({ provenanceFailure: diagnostic, result: {} })).toThrow();
  expect(readProvenanceFailure(Object.assign(new Error('private'), { diagnostic }))).toBeNull();
});

test('real runner failure stops before any Docker command and becomes actionable blocked evidence', async () => {
  const run = jest.fn(() => ({ status: 1, stdout: '', stderr: 'HTTP 401: private' }));
  const receipt = await runRuntimeInstallationAcceptance({ resourceBudget: true,
    source: () => ({ sourceRevision: 'a'.repeat(40), worktreeClean: true }),
    drill: options => runInstallationWithRouting(options, { verify: () => verifyPublishedUpgradeProvenance({ run }) }),
    save: () => {} });
  expect(run.mock.calls.map(([command]) => command)).toEqual(['gh']);
  expect(receipt.status).toBe('blocked');
  expect(receipt.failureStage).toBe('preflight');
  expect(receipt.provenanceFailure.reason).toBe('authentication_failed');
  expect(receipt.resourceBudget.status).toBe('not_verified');
  expect(JSON.stringify(receipt)).not.toContain('private');
});
