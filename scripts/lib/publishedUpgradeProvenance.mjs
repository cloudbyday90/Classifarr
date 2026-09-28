/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

export const upgradeBaseline = Object.freeze({
  release: 'v0.48.4-beta',
  image: 'ghcr.io/cloudbyday90/classifarr@sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f',
  revision: 'a0e417fd714919bb4ca30e20f9cd2380136ca74e',
});
const reasons = new Set(['cli_missing', 'command_timeout', 'authentication_failed', 'access_or_rate_limit', 'verification_failed']);
const sources = new Set(['GH_TOKEN', 'GITHUB_TOKEN', 'stored_cli']);

function credentialSource(env) {
  if (env.GH_TOKEN) return 'GH_TOKEN';
  if (env.GITHUB_TOKEN) return 'GITHUB_TOKEN';
  return 'stored_cli';
}

/** Reconstruct allowlisted text; caller-supplied messages never become report content. */
export function provenanceFailureDiagnostic(value) {
  if (value === null || value === undefined) return null;
  assert.ok(reasons.has(value.reason));
  assert.ok(sources.has(value.credentialSource));
  const nextSteps = {
    cli_missing: 'Install GitHub CLI, then rerun the required attestation verification.',
    command_timeout: 'Check GitHub/registry connectivity and rerun; attestation verification remains required.',
    authentication_failed: value.credentialSource === 'stored_cli'
      ? 'Check gh auth status --hostname github.com and repair the intended CLI login; do not disable verification.'
      : `Check gh auth status --hostname github.com. ${value.credentialSource} overrides stored CLI credentials; correct it, or explicitly remove that override for this local invocation. In CI, repair the supplied token.`,
    access_or_rate_limit: 'Check GitHub/registry access and rate limits for the intended credential; do not automatically broaden permissions or switch accounts.',
    verification_failed: 'Check availability and provenance of the pinned baseline; keep the digest, signer and source constraints enabled.',
  };
  return { reason: value.reason, credentialSource: value.credentialSource, nextStep: nextSteps[value.reason] };
}

export class PublishedUpgradeProvenanceError extends Error {
  constructor(reason, source) {
    super('upgrade_command_failed:gh:attestation');
    this.name = 'PublishedUpgradeProvenanceError';
    this.diagnostic = Object.freeze(provenanceFailureDiagnostic({ reason, credentialSource: source }));
  }
}

export function readProvenanceFailure(error) {
  return error instanceof PublishedUpgradeProvenanceError ? provenanceFailureDiagnostic(error.diagnostic) : null;
}

function classify(result) {
  if (result?.error?.code === 'ENOENT') return 'cli_missing';
  if (result?.error?.code === 'ETIMEDOUT') return 'command_timeout';
  // Interpret only known indicators; never retain the CLI response or exception.
  const output = [result?.stderr, result?.stdout].filter(value => typeof value === 'string').join('\n');
  if (/\bHTTP 401\b|\bbad credentials\b|\bgh auth login\b/i.test(output)) return 'authentication_failed';
  if (/\bHTTP (?:403|429)\b|\brate limit exceeded\b/i.test(output)) return 'access_or_rate_limit';
  return 'verification_failed';
}

/** One fixed verification, before Docker ownership. Never retry with another identity. */
export function verifyPublishedUpgradeProvenance({ run = spawnSync, env = process.env, cwd } = {}) {
  const source = credentialSource(env);
  // Disable inherited transport debug output without removing or exposing credentials.
  const commandEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^(GH_DEBUG|DEBUG)$/i.test(key)));
  Object.assign(commandEnv, { GH_PROMPT_DISABLED: '1', NO_COLOR: '1' });
  let result;
  try {
    result = run('gh', ['attestation', 'verify', `oci://${upgradeBaseline.image}`, '--repo', 'cloudbyday90/Classifarr',
      '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml', '--source-digest', upgradeBaseline.revision,
      '--deny-self-hosted-runners', '--hostname', 'github.com'], {
      cwd, env: commandEnv, shell: false, windowsHide: true, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    // Preserve only a recognised process error code, never error text/cause/output.
    result = { error: { code: error?.code } };
  }
  if (!result?.error && result?.status === 0 && typeof result.stdout === 'string') return;
  throw new PublishedUpgradeProvenanceError(classify(result), source);
}
